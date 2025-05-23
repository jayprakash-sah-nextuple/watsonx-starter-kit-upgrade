import { Injectable, Logger, Scope } from '@nestjs/common';
import { JwtHelperService } from '../core';
import { OmsApiClient } from './oms-api-client';
import { get } from 'lodash';
import { GetPageTemplatesService } from './getPage-templates.service';

@Injectable({ scope: Scope.REQUEST })
export class CancelOrderApiService {
  private readonly logger = new Logger(CancelOrderApiService.name);

  constructor(
    private readonly omsClient: OmsApiClient,
    private jwtHelperService: JwtHelperService,
    private templatesSvc: GetPageTemplatesService,
  ) {}

  public async cancelOrder(OrderHeaderKey: string, reason: { label: string; value: string }) {
    this.logger.log(`Cancelling order ${OrderHeaderKey} for reason: ${reason.label} for value: ${reason.value}`);
    return this.omsClient.invokeApiAsync('invoke/cancelOrder', this.jwtHelperService.jwt, {
      OrderHeaderKey: OrderHeaderKey,
      ModificationReasonCode: reason.value,
      ModificationReasonText: reason.label,
      Notes: {
        Note: {
          NoteText: `The entire order was canceled due to reason: ${reason.label}`,
          Createuserid: 'admin',
          Modifyuserid: 'admin',
        },
      },
    });
  }

  public async getCancellationReason(enterpriseCode: string): Promise<any> {
    const Template = this.templatesSvc.getPageTemplate('common', 'getCommonCodeList');
    return this.omsClient
      .getPageAsync(
        {
          Name: 'getCommonCodeList',
          Input: {
            CommonCode: {
              CallingOrganizationCode: enterpriseCode,
              CodeType: 'YCD_CANCEL_REASON',
              DisplayLocalizedFieldInLocale: 'xml:CurrentUser:/User/@Localecode',
              DocumentType: '0001',
            },
          },
          Template,
        },
        this.jwtHelperService.jwt,
      )
      .then((res) => get(res, 'Output.CommonCodeList.CommonCode'));
  }
}
