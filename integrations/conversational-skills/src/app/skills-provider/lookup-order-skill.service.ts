import { Inject, Logger } from '@nestjs/common';
import { AbstractSkillProviderService } from '../skills-api/abstract-skill-provider.service';
import { Slot, SlotType, EntityValue, Entity, SlotValue } from '../../conv-sdk/index';
import { Constants } from '../common/constants';
import { areAllParametersSet, getArray } from '../common/functions';
import { Skill, OnSlotChange } from '../../decorators';
import { LookupOrderApiService, OmsCommonService } from '../oms';

export const ORDER_NO_SLOT = 'OrderNo';
export const ENTERPRISE_CODE_SLOT = 'EnterpriseCode';
export const ORDER_TOTAL = 'OrderTotal';
/**
 * This skill looks up an order based on the order number and the enterprise code.
 * The skill has two slots:
 * - OrderNo - This slot is validated with a regular expression
 * - EnterpriseCode - This is an entity based slot that displays as a dropdown. The dropdown is populated
 * using `getOrganizationList` API.
 *
 * The skill takes additional input for other skills that extend or use this skill.
 * - additionalApiInput - This is additional input passed to the `getCompleteOrderDetails` API
 * - stopAtLookup - This decides if the skill should be marked complete. Used by other skills which want to continue the conversation after the order is setup in context.
 *
 * Once the slots are filled, the skill invokes `getCompleteOrderDetails` API and the order is set in the context.
 */
@Skill({
  skillId: Constants.LOOKUP_ORDER_SKILL_ID,
  slots: [{ name: ORDER_NO_SLOT }, { name: ENTERPRISE_CODE_SLOT, type: SlotType.ENTITY }],
})
export class LookupOrderSkillService extends AbstractSkillProviderService {
  protected readonly logger: Logger = new Logger('LookupOrderSkillService');

  private readonly ORDER_NO_REGEX = new RegExp('(OM|Y|ORD|RET)(\\w+|((-|_)\\w+)+)', 'g');

  @Inject()
  protected commonService: OmsCommonService;

  @Inject()
  protected apiService: LookupOrderApiService;

  constructor() {
    super();
    this.additionalSkillInput = { additionalApiInput: {} };
  }

  protected async initializeSlotsInFlight() {
    await this.setEnterpriseListInSlot();
  }

  protected async postOnSlotStateChange() {
    const parameters = this.getNormalizedSlotValues([ORDER_NO_SLOT, ENTERPRISE_CODE_SLOT]);
    console.log('postOnSlotStateChange', parameters);
    if (areAllParametersSet(parameters)) {
      try {
        const orderDetails = await this.apiService.getOrderDetails({
          ...parameters,
          ...this.additionalSkillInput.additionalApiInput,
        });
        this.constructOrderDetailsResponse(orderDetails);
        this.setCurrentOrderInContext(orderDetails.Order);
        this.additionalSkillInput.stopAtLookup ?? this.markSkillComplete({ order: orderDetails.Order });
      } catch (err) {
        this.logger.error('Failed to retrieve order', err);
        const message = this.getStringLiteral('actionResponses.notFound', parameters);
        console.log('message', message);
        this.addTextResponse(message);
        this.markSkillComplete({ failed: true, message });
      }
    }
  }

  protected canUseCurrentOrderFromContext() {
    const value =
      this.getFromSessionOrContext(Constants.SESSION_VARIABLE_USE_CURRENT_ORDER_IN_CONTEXT).value ||
      this.getLocalVariable(Constants.SESSION_VARIABLE_USE_CURRENT_ORDER_IN_CONTEXT);
    return value === true || value === 'true';
  }

  private constructOrderDetailsResponse(orderDetails: any) {
    const responseLiterals = this.getStringLiteralArray('actionResponses.success', orderDetails);
    responseLiterals.forEach((rl, i) =>
      i === 1
        ? this.commonService.sendOrderDetailsLinkResponse(this.getSkillResponse(), rl, orderDetails.Order)
        : this.addTextResponse(rl),
    );
    this.commonService.gotoOrderDetailsTab(this.getSkillResponse(), orderDetails.Order);
  }

  private gatherEnterpriseCode(): void {
    const enterpriseCodeSlot: Slot = this.getSkillResponseSlot(ENTERPRISE_CODE_SLOT);
    const ctxEnterpriseCode = this.getFromSessionOrContext(Constants.SESSION_VARIABLE_ENTERPRISE_CODE);
    if (ctxEnterpriseCode.value) {
      enterpriseCodeSlot.value = new SlotValue(ctxEnterpriseCode.value, ctxEnterpriseCode.value);
    }
  }

  @OnSlotChange(ENTERPRISE_CODE_SLOT)
  private async onEnterpriseCodeChange(slot: Slot, slotInFlight: Slot) {
    const value = slot.value.normalized;
    // validate the enterprise
    const selectedEnterprise = (await this.getEnterpriseList()).find((e) => e.id === value);
    if (selectedEnterprise) {
      this.logger.log(`The enterprise code is ${selectedEnterprise.id}`);
      slotInFlight.value = new SlotValue(selectedEnterprise.label, selectedEnterprise.id);
    } else {
      this.logger.log(`The enterprise code ${value} is invalid`);
      slotInFlight.value = undefined;
      slotInFlight.setError = this.getErrorForSlot(ENTERPRISE_CODE_SLOT, 'invalid', { value });
    }
    this.setCurrentOrderInContext(null);
  }

  @OnSlotChange(ORDER_NO_SLOT)
  private async onOrderNoChange(slot: Slot, slotInFlight: Slot) {
    const value = slot.value.normalized;
    const orderNumberMatches = (value || '').match(this.ORDER_NO_REGEX);
    if (orderNumberMatches === null || orderNumberMatches.length === 0) {
      this.logger.log(`The order number ${value} does not match the pattern`);
      slotInFlight.value = undefined;
      slotInFlight.setError = this.getErrorForSlot(ORDER_NO_SLOT, 'notInferred', { value });
    } else if (orderNumberMatches.length === 1) {
      this.logger.log(`The order number is ${orderNumberMatches[0]}`);
      slotInFlight.value = { literal: orderNumberMatches[0], normalized: orderNumberMatches[0] };
    } else if (orderNumberMatches.length > 1) {
      const slotValue = { literal: orderNumberMatches.join(','), normalized: orderNumberMatches };
      this.logger.log(`Found multiple order numbers in the prompt : ${slotValue.literal}`);
      slotInFlight.value = slotValue;
    }
    slotInFlight.value ? this.gatherEnterpriseCode() : '';
    this.setCurrentOrderInContext(null);
  }

  private async setEnterpriseListInSlot() {
    const options = (await this.getEnterpriseList()).map(
      (e) => new EntityValue({ label: e.label, value: e.id, synonyms: [e.label, e.id], patterns: undefined }),
    );
    this.getSkillResponseSlot(ENTERPRISE_CODE_SLOT).schema = new Entity(ENTERPRISE_CODE_SLOT, options);
  }

  private async getEnterpriseList() {
    let enterpriseList: any[] = this.getFromSessionOrContext(Constants.SESSION_VARIABLE_ENTERPRISE_LIST).value;
    if (!enterpriseList) {
      // fetch orgs for user
      const orgsListResponse = await this.apiService.getOrganizationList();
      if (orgsListResponse) {
        enterpriseList = getArray(orgsListResponse.Organization).map((o) => ({
          id: o.OrganizationCode,
          label: o.OrganizationName,
        }));
      }
      this.setSessionVariable(Constants.SESSION_VARIABLE_ENTERPRISE_LIST, enterpriseList);
    }
    return enterpriseList;
  }
}
