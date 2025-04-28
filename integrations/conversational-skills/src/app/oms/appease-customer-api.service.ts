import { Injectable, Logger, Scope } from '@nestjs/common';
import { JwtHelperService } from '../core';
import { OmsApiClient } from './oms-api-client';
import { get } from 'lodash';
import { GetPageTemplatesService } from './getPage-templates.service';

@Injectable({ scope: Scope.REQUEST })
export class AppeaseCustomerService {
  private readonly logger = new Logger(AppeaseCustomerService.name);

  constructor(
    private readonly omsClient: OmsApiClient,
    private jwtHelperService: JwtHelperService,
    private templatesSvc: GetPageTemplatesService,
  ) {}

  public async getAppeaseReasonList(enterpriseCode: string): Promise<any> {
    this.logger.log(`Fetching appease reason list for enterprise code: ${enterpriseCode}`);
    const Template = this.templatesSvc.getPageTemplate('common', 'getCommonCodeList');
    return this.omsClient
      .getPageAsync(
        {
          Name: 'getCommonCodeList',
          Input: {
            CommonCode: {
              CallingOrganizationCode: enterpriseCode,
              CodeType: 'YCD_APPEASEMENT_RSN',
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
