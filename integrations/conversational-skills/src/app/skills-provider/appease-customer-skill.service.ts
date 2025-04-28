import { Inject, Logger } from '@nestjs/common';
import { Entity, EntityValue, Slot, SlotType, SlotValue } from '../../conv-sdk';
import { Constants } from '../common/constants';
import { getArray } from '../common/functions';
import { OnSlotChange, Skill } from '../../decorators';
import { ENTERPRISE_CODE_SLOT, LookupOrderSkillService, ORDER_NO_SLOT } from './lookup-order-skill.service';
import { AppeaseCustomerService } from '../oms/appease-customer-api.service';

const APPEASE_REASON_SLOT = 'AppeasementReason';
const APPEASE_OPTION_SLOT = 'AppeasementOption';
const DISCOUNT_PERCENT_SLOT = 'AppeasementDiscountPercent';

const APPEASE_OPTION_LIST = [
  { name: 'Coupon', value: 'COUPON' },
  { name: 'Partial Refund', value: 'PARTIAL_REFUND' },
  { name: 'Issue Gift Card', value: 'ISSUE_GIFT_CARD' },
];

@Skill({
  skillId: Constants.APPEASE_CUSTOMER_SKILL_ID,
  slots: [
    { name: APPEASE_REASON_SLOT, type: SlotType.ENTITY },
    { name: APPEASE_OPTION_SLOT, type: SlotType.ENTITY },
  ],
})
export class AppeaseCustomerSkillService extends LookupOrderSkillService {
  protected readonly logger: Logger = new Logger('AppeaseCustomerSkillService');

  private readonly MODIFICATION_TYPE_APPEASE_CUSTOMER = 'APPEASE_CUSTOMER';

  @Inject()
  protected appeaseCustomerApi: AppeaseCustomerService;

  private readonly additionalApiInput = {};

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
    this.getSkillResponseSlot(APPEASE_REASON_SLOT).schema = new Entity(APPEASE_REASON_SLOT, []);

    const appeaseOptionList = APPEASE_OPTION_LIST.map(
      (opt) =>
        new EntityValue({
          label: opt.name,
          value: opt.value,
          synonyms: [opt.name, opt.value],
          patterns: undefined,
        }),
    );
    this.getSkillResponseSlot(APPEASE_OPTION_SLOT).schema = new Entity(APPEASE_OPTION_SLOT, appeaseOptionList);
  }

  @OnSlotChange(ENTERPRISE_CODE_SLOT)
  private async onEnterpriseCodeChangeValue(slot: Slot) {
    const value = slot.value.normalized;
    const reasonOptions = (await this.getAppeaseOptionsList(value))?.map(
      (opt) =>
        new EntityValue({
          label: opt.label,
          value: opt.value,
          synonyms: [opt.label, opt.value],
          patterns: undefined,
        }),
    );

    this.getSkillResponseSlot(APPEASE_REASON_SLOT).schema = new Entity(APPEASE_REASON_SLOT, reasonOptions);
  }

  @OnSlotChange(APPEASE_REASON_SLOT)
  private async onAppeaseReasonChange(slot: Slot, slotInFlight: Slot) {
    const rawValue = slot.value.normalized;
    const selected = (await this.getAppeaseOptionsList()).find(
      (r) => r.value.toLowerCase() === rawValue.toLowerCase() || r.value === rawValue,
    );

    if (!selected) {
      this.logger.log(`Invalid Appeasement reason: ${rawValue}`);
      slotInFlight.value = undefined;
      slotInFlight.setError = this.getErrorForSlot(APPEASE_REASON_SLOT, 'invalid', { value: rawValue });
    }
  }

  @OnSlotChange(APPEASE_OPTION_SLOT)
  private async onAppeaseOptionChange(slot: Slot, slotInFlight: Slot) {
    const rawValue = slot.value.normalized;
    const selected = APPEASE_OPTION_LIST.find(
      (r) => r.name.toLowerCase() === rawValue.toLowerCase() || r.value === rawValue,
    );
    if (selected) {
      slotInFlight.value = new SlotValue(selected.name, selected.value);
    } else {
      this.logger.log(`Invalid cancellation reason: ${rawValue}`);
      slotInFlight.value = undefined;
      slotInFlight.setError = this.getErrorForSlot(APPEASE_OPTION_SLOT, 'invalid', { value: rawValue });
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
      this.setLocalVariable(Constants.SESSION_VARIABLE_USE_CURRENT_ORDER_IN_CONTEXT, true);
      this.setSlotStringValue(ORDER_NO_SLOT, currentOrder.OrderNo);
      this.setSlotStringValue(ENTERPRISE_CODE_SLOT, currentOrder.EnterpriseCode);
      return true;
    }
    return false;
  }

  private async getAppeaseOptionsList(enterpriseCode: string = ''): Promise<any[]> {
    let appeaseOptionList: any[] = this.getFromSessionOrContext(Constants.SESSION_VARIABLE_APPEASE_OPTION_LIST).value;
    if (enterpriseCode !== '' && !appeaseOptionList) {
      const appeaseOptionListFromAPI = await this.appeaseCustomerApi.getAppeaseReasonList(enterpriseCode);
      if (appeaseOptionListFromAPI) {
        appeaseOptionList = getArray(appeaseOptionListFromAPI).map((o) => ({
          label: o.CodeShortDescription,
          value: o.CodeValue,
        }));
      }
      this.setSessionVariable(Constants.SESSION_VARIABLE_APPEASE_OPTION_LIST, appeaseOptionList);
    }
    return appeaseOptionList;
  }

  private async getAppeasementOption(enterpriseCode: string = '', appeasementReason: string = '') {}
}
