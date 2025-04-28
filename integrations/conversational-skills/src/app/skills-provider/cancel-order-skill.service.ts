import { Inject, Logger } from '@nestjs/common';
import { Entity, EntityValue, Slot, SlotType, SlotValue } from '../../conv-sdk';
import { Constants } from '../common/constants';
import { getArray, getModificationType, isModificationAllowed, isVoid } from '../common/functions';
import { OnSlotChange, Skill } from '../../decorators';
import { ENTERPRISE_CODE_SLOT, LookupOrderSkillService, ORDER_NO_SLOT } from './lookup-order-skill.service';
import { CancelOrderApiService } from '../oms';

const CANCEL_CONFIRMATION_SLOT = 'ConfirmCancelAction';
const CANCELLATION_REASON_SLOT = 'CancellationReason';
/**
 * This skill cancels an order.
 * The skill does not consider the order in context until it is told do so using `useCurrentOrderInContext` session variable.
 * The skill leverages the {@link LookupOrderSkillService} by extension to gather the order to be cancelled.
 *
 * The skill has one additional slot apart from the slots inherited from the look up order skill.
 * - ConfirmCancelAction - This is a confirmation slot asking the user to confirm the cancellation.
 *
 * The skill checks if cancellation is allowed by using `ModificationType` `CANCEL`
 */
@Skill({
  skillId: Constants.CANCEL_ORDER_SKILL_ID,
  slots: [
    { name: CANCELLATION_REASON_SLOT, type: SlotType.ENTITY },
    { name: CANCEL_CONFIRMATION_SLOT, type: SlotType.CONFIRMATION },
  ],
})
export class CancelOrderSkillService extends LookupOrderSkillService {
  private readonly MODIFICATION_TYPE_CANCEL = 'CANCEL';
  protected readonly logger: Logger = new Logger('CancelOrderSkillService');

  @Inject()
  protected cancelApiService: CancelOrderApiService;

  private readonly additionalApiInput = {
    Modifications: {
      Modification: [{ ModificationType: this.MODIFICATION_TYPE_CANCEL }],
    },
  };

  constructor() {
    super();
    this.additionalSkillInput = {
      additionalApiInput: this.additionalApiInput,
      stopAtLookup: false,
    };
  }

  protected async initializeSlotsInFlight(): Promise<void> {
    await super.initializeSlotsInFlight();

    const useCurrentOrderInContext = this.canUseCurrentOrderFromContext();
    if (!useCurrentOrderInContext) {
      this.deleteCurrentOrderFromContext();
    }
    this.getSkillResponseSlot(CANCELLATION_REASON_SLOT).schema = new Entity(CANCELLATION_REASON_SLOT, []);
  }
  
  @OnSlotChange(ENTERPRISE_CODE_SLOT)
  private async onEnterpriseCodeChangeValue(slot: Slot) {
    const value = slot.value.normalized;
    const reasonOptions = (await this.getCancelReasonList(value))?.map(
      (opt) =>
        new EntityValue({
          label: opt.label,
          value: opt.value,
          synonyms: [opt.label, opt.value],
          patterns: undefined,
        }),
    );
    
    this.getSkillResponseSlot(CANCELLATION_REASON_SLOT).schema = new Entity(CANCELLATION_REASON_SLOT, reasonOptions);
  }

  @OnSlotChange(CANCELLATION_REASON_SLOT)
  private async onCancellationReasonChange(slot: Slot, slotInFlight: Slot) {
    const rawValue = slot.value.normalized;
    const selected = (await this.getCancelReasonList()).find(
      (r) => r.label.toLowerCase() === rawValue.toLowerCase() || r.value === rawValue,
    );
    if (selected) {
      slotInFlight.value = new SlotValue(selected.label, selected.value);
    } else {
      this.logger.log(`Invalid cancellation reason: ${rawValue}`);
      slotInFlight.value = undefined;
      slotInFlight.setError = this.getErrorForSlot(CANCELLATION_REASON_SLOT, 'invalid', { value: rawValue });
    }
  }

  @OnSlotChange(CANCEL_CONFIRMATION_SLOT)
  private async onCancelConfirmationChange(slot: Slot) {
    let skillCompleteMetadata: any = {};
    const order = this.getCurrentOrderFromContext();
    const reason = (await this.getCancelReasonList()).find((r)=>r.value ===  this.getCurrentSlotValue(CANCELLATION_REASON_SLOT));
    try {
      if (slot.value.normalized === 'yes') {
        await this.cancelApiService.cancelOrder(order.OrderHeaderKey, reason);
        this.addTextResponse(this.getStringLiteral('actionResponses.cancellationSuccessful', order));
        skillCompleteMetadata.orderCancelled = true;
      } else {
        this.addTextResponse(this.getStringLiteral('actionResponses.actionCancelled', order));
        skillCompleteMetadata = { orderCancelled: false, userCancelled: true };
      }
    } catch (err) {
      this.logger.error('Failed to cancel order', err);
      const message = this.getStringLiteral('actionResponses.cancellationFailed', order);
      this.addTextResponse(message);
      skillCompleteMetadata = { orderCancelled: false, failed: true, message };
    } finally {
      this.commonService.gotoOrderDetailsTab(this.getSkillResponse(), order);
      this.deleteCurrentOrderFromContext();
      this.deleteLocalVariable(Constants.SESSION_VARIABLE_USE_CURRENT_ORDER_IN_CONTEXT);
      this.markSkillComplete(skillCompleteMetadata);
    }
  }

  protected async postOnSlotStateChange(): Promise<void> {
    const isCurrentOrderProcessed = await this.processCurrentOrder();
    if (!isCurrentOrderProcessed) {
      await super.postOnSlotStateChange();
      await this.processCurrentOrder();
    }
  }

  private async processCurrentOrder() {
    const currentOrder = this.getCurrentOrderFromContext();
    if (currentOrder) {
      const isCancelAllowed = await this.isCancelAllowed(currentOrder);
      if (isCancelAllowed) {
        this.setLocalVariable(Constants.SESSION_VARIABLE_USE_CURRENT_ORDER_IN_CONTEXT, true);
        this.setSlotStringValue(ORDER_NO_SLOT, currentOrder.OrderNo);
        this.setSlotStringValue(ENTERPRISE_CODE_SLOT, currentOrder.EnterpriseCode);
        this.setSlotStringValue(CANCEL_CONFIRMATION_SLOT, undefined);
        this.setSlotPrompt(CANCEL_CONFIRMATION_SLOT, undefined, currentOrder);
      } else {
        this.deleteCurrentOrderFromContext();
        this.addTextResponse(this.getStringLiteral('actionResponses.notAllowed', currentOrder));
        this.markSkillComplete({ orderCancelled: false, modificationAllowed: false });
      }
      return true;
    }
    return false;
  }

  private async isCancelAllowed(currentOrder: any) {
    let isCancelAllowed = this.getLocalVariable(`${this.MODIFICATION_TYPE_CANCEL}-${currentOrder.OrderHeaderKey}`);
    if (isVoid(isCancelAllowed)) {
      isCancelAllowed =
        getModificationType(currentOrder, this.MODIFICATION_TYPE_CANCEL).length === 0
          ? this.commonService.isModificationAllowed(this.MODIFICATION_TYPE_CANCEL, currentOrder.OrderHeaderKey)
          : isModificationAllowed(currentOrder, this.MODIFICATION_TYPE_CANCEL);
      this.setLocalVariable(`${this.MODIFICATION_TYPE_CANCEL}-${currentOrder.OrderHeaderKey}`, isCancelAllowed);
    }
    return isCancelAllowed;
  }

  private async getCancelReasonList(enterpriseCode: string=''): Promise<any[]> {
      let cancelReasonList: any[] = this.getFromSessionOrContext(Constants.SESSION_VARIABLE_CANCELLATION_REASON_LIST).value;
      if (enterpriseCode!=='' && !cancelReasonList) {
        const cancelReasonListFromAPI = await this.cancelApiService.getCancellationReason(enterpriseCode);
        if (cancelReasonListFromAPI) {
          cancelReasonList = getArray(cancelReasonListFromAPI).map((o) => ({
            label: o.CodeShortDescription,
            value:o.CodeValue,
          }));
        }
        this.setSessionVariable(Constants.SESSION_VARIABLE_CANCELLATION_REASON_LIST, cancelReasonList);
      }
      return cancelReasonList;
    }
}
