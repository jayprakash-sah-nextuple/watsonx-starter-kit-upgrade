import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { OmsApiClient } from './oms-api-client';
import { GetPageTemplatesService } from './getPage-templates.service';
import { OmsCommonService } from './oms-common.service';
import { LookupOrderApiService } from './lookup-order-api.service';
import { CancelOrderApiService } from './cancel-order-api.service';
import { ApplyCouponApiService } from './apply-coupon-api.service';
import { HoldsApiService } from './holds-api.service';
import { SearchOrdersApiService } from './search-orders-api.service';
import { CustomerAppeasementApiService } from './customer-appeasement-api.service';
import { CoreModule } from '../core/core.module';
import { AppeaseCustomerService } from './appease-customer-api.service';
const providers = [
  OmsApiClient,
  GetPageTemplatesService,
  OmsCommonService,
  LookupOrderApiService,
  CancelOrderApiService,
  ApplyCouponApiService,
  HoldsApiService,
  SearchOrdersApiService,
  CustomerAppeasementApiService,
  AppeaseCustomerService,
];

@Module({
  imports: [HttpModule, CoreModule],
  providers,
  exports: [...providers, HttpModule],
})
export class OmsModule {}
