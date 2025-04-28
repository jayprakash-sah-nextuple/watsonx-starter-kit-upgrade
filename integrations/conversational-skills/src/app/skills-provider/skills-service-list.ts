import { LookupOrderSkillService } from './lookup-order-skill.service';
import { CancelOrderSkillService } from './cancel-order-skill.service';
import { ApplyCouponSkillService } from './apply-coupon-skill.service';
import { HoldsSkillService } from './holds-skill.service';
import { SearchOrdersSkillService } from './search-orders/search-orders-skill.service';
import { MostRecentOrderSkillService } from './search-orders/most-recent-order/most-recent-order-skill.service';
import { MostRecentTransactionSkillService } from './search-orders/most-recent-transaction/most-recent-transaction-skill.service';
import { MostRecentPaymentSkillService } from './search-orders/most-recent-payment-method/most-recent-payment.service';
import { SearchOrdersByDescriptionSkillService } from './search-orders/by-item-description/search-orders-by-desc-skill.service';
import { MinimalSkillService } from './minimal-skill.service';
import { NotesSummarizationSkillService } from './notes-summarization-skill.service';

import { FindAppeasementsSkillService } from './customer-appeasement/find-appeasements-skill.service';
import { RecommendAppeasementSkillService } from './customer-appeasement/recommend-appeasement-skill.service';
import { AppeaseCustomerSkillService } from './appease-customer-skill.service';

export const SKILLS_SERVICE_LIST = [
  LookupOrderSkillService,
  CancelOrderSkillService,
  ApplyCouponSkillService,
  MostRecentOrderSkillService,
  SearchOrdersSkillService,
  NotesSummarizationSkillService,
  SearchOrdersByDescriptionSkillService,
  HoldsSkillService,
  MinimalSkillService,
  MostRecentTransactionSkillService,
  MostRecentPaymentSkillService,
  FindAppeasementsSkillService,
  RecommendAppeasementSkillService,
  AppeaseCustomerSkillService
];
