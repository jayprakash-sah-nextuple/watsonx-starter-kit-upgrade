import { Injectable, Logger, Scope } from '@nestjs/common';
import { JwtHelperService } from '../core';
import { Constants } from '../common/constants';
import { getArray } from 'src/app/common/functions';
import { get } from 'lodash';
import { OmsApiClient } from './oms-api-client';
import { GetPageTemplatesService } from './getPage-templates.service';

@Injectable({ scope: Scope.REQUEST })
export class ApplyCouponApiService {
  private readonly logger = new Logger(ApplyCouponApiService.name);

  constructor(
    private readonly omsClient: OmsApiClient,
    private jwtHelperService: JwtHelperService,
    private templatesSvc: GetPageTemplatesService,
  ) {}

  public async applyCoupon(input: { OrderHeaderKey: string; PromotionId: string; Note?: any }): Promise<any> {
    const response = await this.omsClient.getPageAsync(
      {
        Name: 'changeOrder',
        Input: {
          Order: {
            OrderHeaderKey: input.OrderHeaderKey,
            Promotions: { Promotion: [{ PromotionId: input.PromotionId }] },
            ...(input.Note ? { Notes: { Note: input.Note } } : {}),
          },
        },
        Template: this.templatesSvc.getPageTemplate(Constants.APPLY_COUPON_SKILL_ID, 'default'),
      },
      this.jwtHelperService.jwt,
    );

    const promotionApplied = getArray(get(response, 'Output.Order.Promotions.Promotion')).find(
      (p) => p.PromotionId === input.PromotionId && p.PromotionApplied === 'Y',
    );

    const orderTotal = get(response, 'Output.Order.PriceInfo.Total');
    const discountAmount = get(response, 'Output.Order.PriceInfo.DiscountAmount');

    return {
      success: promotionApplied !== undefined,
      message: promotionApplied !== undefined ? 'Coupon applied successfully' : 'Coupon application failed',
      orderTotal,
      discountAmount,
    };
  }

  public async validateCoupon(PromotionId: string, currentOrder: any) {
    return this.omsClient
      .invokeApiAsync('invoke/validateCoupon', this.jwtHelperService.jwt, {
        CouponID: PromotionId,
        Currency: currentOrder.PriceInfo.Currency,
        OrganizationCode: currentOrder.EnterpriseCode,
      })
      .then((res) => res.CouponStatusMsgCode !== 'YPM_RULE_INVALID' && res.Valid === 'Y');
  }
}
