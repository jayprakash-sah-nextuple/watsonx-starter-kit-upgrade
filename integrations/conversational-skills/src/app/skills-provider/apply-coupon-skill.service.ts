import { Logger } from '@nestjs/common';
import { Constants } from '../common/constants';
import { SkillResponse, Slot } from '../../conv-sdk';
import { SkillCallbackInput } from '../skills-api/skill-callback-input.interface';
import { getModificationType, isModificationAllowed } from '../common/functions';
import {
  LookupOrderSkillService,
  ENTERPRISE_CODE_SLOT,
  ORDER_NO_SLOT,
  ORDER_TOTAL,
} from './lookup-order-skill.service';
import { Skill } from '../../decorators';
import { RequireConfirmation } from '../skills-api/require-confirmation.interface';
import { ApplyCouponApiService } from '../oms';

const PROMOTION_ID_SLOT = 'PromotionId';
/**
 * This skill applies a coupon to an order. The coupon is applied at the Order level.
 * The skill does not consider the order in context until it is told do so using `useCurrentOrderInContext` session variable.
 * The skill leverages the {@link LookupOrderSkillService} by extension to gather the order to apply the coupon.
 *
 * The skill has one additional slot apart from the slots inherited from the look up order skill.
 * - PromotionId - This is a freeform string slot and is validated using `validateCoupon` API
 *
 * The skill is marked as `confirmation: 'required'` for the assistant to ask for confirmation of
 * all values gathered so that the coupon can be applied. The skill also validates if a coupon
 * can be applied to the order in context by using `ModificationType` `[PRICE, CHANGE_PROMOTION]`
 */
@Skill({
  skillId: Constants.APPLY_COUPON_SKILL_ID,
  slots: [{ name: PROMOTION_ID_SLOT }],
  confirmation: 'required',
})
export class ApplyCouponSkillService extends LookupOrderSkillService implements RequireConfirmation {
  protected readonly logger: Logger = new Logger('ApplyCouponSkillService');

  private readonly MOD_TYPES = ['PRICE', 'CHANGE_PROMOTION'];

  private readonly VARIABLE_APPLY_COUPON_AS_APPEASEMENT = 'applyCouponAsAppeasement';

  private readonly additionalApiInput = {
    Modifications: {
      Modification: this.MOD_TYPES.map((m) => ({ ModificationType: m })),
    },
  };

  constructor(private applyCouponSvc: ApplyCouponApiService) {
    super();
    this.additionalSkillInput = {
      additionalApiInput: this.additionalApiInput,
      stopAtLookup: false,
    };
  }

  public async onConfirm(input: SkillCallbackInput): Promise<SkillResponse> {
    const order = this.getCurrentOrderFromContext();
    const PromotionId = this.getCurrentSlotValue(PROMOTION_ID_SLOT);
    let metadata = {};
    try {
      this.logger.log(`Applying coupon to order ${order.OrderNo} ${PromotionId}`);
      const response = await this.applyCouponSvc.applyCoupon({
        OrderHeaderKey: order.OrderHeaderKey,
        PromotionId,
        ...(this.getFromSessionOrContext(this.VARIABLE_APPLY_COUPON_AS_APPEASEMENT).value
          ? {
              Note: {
                NoteText: 'Appeasement provided due to bad customer experience',
                Priority: 0,
                ReasonCode: 'YCD_CUSTOMER_APPEASE',
                VisibleToAll: 'Y',
              },
            }
          : {}),
      });

      const isPromotionApplied = response.success;
      const orderTotal = response.orderTotal;
      const discountAmount = response.discountAmount;

      const literal = isPromotionApplied ? 'actionResponses.couponApplied' : 'actionResponses.couponNotApplied';

      let message = this.getStringLiteral(literal, { PromotionId, OrderNo: order.OrderNo });
      if (isPromotionApplied) {
        message += ` Your new order total is $${orderTotal} with a discount of $${discountAmount}.`;
      }

      this.addTextResponse(message);
      metadata = {
        promotionApplied: isPromotionApplied,
        orderTotal,
        discountAmount,
      };
    } catch (err) {
      this.logger.error('Failed to apply coupon', err);
      const message = this.getStringLiteral('actionResponses.failed', { PromotionId, OrderNo: order.OrderNo });
      this.addTextResponse(message);
      metadata = { promotionApplied: false, failed: true, message };
    } finally {
      this.commonService.gotoOrderDetailsTab(input.skillResponse, order);
      this.deleteCurrentOrderFromContext();
      this.deleteLocalVariable(Constants.SESSION_VARIABLE_USE_CURRENT_ORDER_IN_CONTEXT);
      this.markSkillComplete(metadata);
    }
    return input.skillResponse;
  }

  public async onCancel(input: SkillCallbackInput): Promise<SkillResponse> {
    this.addTextResponse(this.getStringLiteral('actionResponses.cancelled'));
    this.deleteCurrentOrderFromContext();
    this.deleteLocalVariable(Constants.SESSION_VARIABLE_USE_CURRENT_ORDER_IN_CONTEXT);
    this.markSkillComplete({ promotionApplied: false, userCancelled: true });
    return input.skillResponse;
  }

  protected async initializeSlotsInFlight(): Promise<void> {
    await super.initializeSlotsInFlight();
    const useCurrentOrderInContext = this.canUseCurrentOrderFromContext();
    if (!useCurrentOrderInContext) {
      this.deleteCurrentOrderFromContext();
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
      const canApplyCoupon = await this.canApplyCoupon(currentOrder);

      if (canApplyCoupon) {
        const promoId = this.getCurrentSlotValue(PROMOTION_ID_SLOT);
        if (promoId) {
          await this.validateCoupon(currentOrder, promoId);
        }
        this.setLocalVariable(Constants.SESSION_VARIABLE_USE_CURRENT_ORDER_IN_CONTEXT, true);
        this.setSlotStringValue(ORDER_NO_SLOT, currentOrder.OrderNo);
        this.setSlotStringValue(ENTERPRISE_CODE_SLOT, currentOrder.EnterpriseCode);
        this.setSlotStringValue(ORDER_TOTAL, currentOrder.PriceInfo.TotalAmount);
      } else {
        this.getSkillResponse().addTextResponse(this.getStringLiteral('actionResponses.notAllowed', currentOrder));
        this.markSkillComplete({ promotionApplied: false, modificationAllowed: canApplyCoupon });
        this.deleteCurrentOrderFromContext();
      }
      return true;
    }
    return false;
  }

  private async validateCoupon(currentOrder: any, PromotionId: string): Promise<void> {
    const isCouponValid =
      this.getLocalVariable(PROMOTION_ID_SLOT) ?? (await this.applyCouponSvc.validateCoupon(PromotionId, currentOrder));
    this.setLocalVariable(PROMOTION_ID_SLOT, isCouponValid);
    if (!isCouponValid) {
      const promoIdSlot: Slot = this.getSkillResponseSlot(PROMOTION_ID_SLOT);
      promoIdSlot.setError = this.getErrorForSlot(PROMOTION_ID_SLOT, 'invalid', { PromotionId });
      promoIdSlot.value = undefined;
    }
  }

  private async canApplyCoupon(currentOrder: any) {
    let canApplyCoupon = this.getLocalVariable(Constants.APPLY_COUPON_SKILL_ID);
    if (canApplyCoupon === undefined) {
      canApplyCoupon =
        getModificationType(currentOrder, this.MOD_TYPES).length === 2
          ? isModificationAllowed(currentOrder, this.MOD_TYPES)
          : await this.commonService.isModificationAllowed(this.MOD_TYPES, currentOrder.OrderHeaderKey);
      this.setLocalVariable(Constants.APPLY_COUPON_SKILL_ID, canApplyCoupon);
    }
    return canApplyCoupon;
  }
}
