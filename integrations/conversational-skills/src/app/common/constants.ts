import { SlotType } from '../../conv-sdk';

export interface PaginationParams {
  PageNumber: number | string;
  PageSize: number | string;
  PaginationStrategy: string;
  Refresh: string;
  PageSetToken?: string;
}

export class Constants {
  static readonly ENV_APPLICATION_CONFIG_YAML_PATH = 'APPLICATION_CONFIG_YAML_PATH';

  static readonly ENV_DIST_DIRECTORY = 'DIST_DIRECTORY';

  static readonly DEFAULT_LISTEN_PORT = 3000;

  static readonly SESSION_VARIABLE_ENTERPRISE_LIST = 'EnterpriseList';

  static readonly SESSION_VARIABLE_ENTERPRISE_CODE = 'EnterpriseCode';

  static readonly SESSION_VARIABLE_CANCELLATION_REASON_LIST = 'CancellationReasonList';

  static readonly SESSION_VARIABLE_APPEASE_OPTION_LIST = 'AppeaseOptionList';
  
  static readonly SESSION_VARIABLE_OMS_JWT = 'OMS_JWT';

  static readonly SESSION_VARIABLE_USE_CURRENT_ORDER_IN_CONTEXT = 'useCurrentOrderInContext';

  static readonly SESSION_VARIABLE_CURRENT_ORDER_NO = 'currentOrderNo';

  static readonly SESSION_VARIABLE_CURRENT_ORDER = 'currentOrder';

  static readonly SESSION_VARIABLE_SKILL_ERROR = 'skills-error';

  static readonly LOCAL_VARIABLE_SKILL_ERROR_COUNT = 'skill-error-count';

  static readonly CANCEL_ORDER_SKILL_ID = 'cancel-order';

  static readonly LOOKUP_ORDER_SKILL_ID = 'lookup-order';

  static readonly APPLY_COUPON_SKILL_ID = 'apply-coupon';

  static readonly SEARCH_ORDERS_SKILL_ID = 'search-orders';

  static readonly MOST_RECENT_ORDER_SKILL_ID = 'most-recent-order';

  static readonly APPEASE_CUSTOMER_SKILL_ID = 'appease-customer-skill';

  static readonly NOTES_SUMMARIZATION_SKILL_ID = 'summarize-order-notes';

  static readonly MOST_RECENT_TRANSACTION_SKILL_ID = 'most-recent-transaction';

  static readonly MOST_RECENT_PAYMENT_METHOD_SKILL_ID = 'most-recent-payment-method';

  static readonly SEARCH_BY_DESC_SKILL_ID = 'search-by-description';

  static readonly MINIMAL_SKILL_ID = 'minimal-skill';

  static readonly HOLDS_SKILL_ID = 'holds-skill';

  static readonly LOOKUP_FAILURE_LOCAL_VARIABLE = `${Constants.SESSION_VARIABLE_SKILL_ERROR}-${Constants.LOOKUP_ORDER_SKILL_ID}`;

  static readonly DOCUMENT_TYPE_LIST_TEMPLATE = 'document-type-list';

  static readonly GET_ORDER_LINE_TEMPLATE = 'order-line-list';

  static readonly SLOT_DEFAULTS = {
    event: undefined,
    hidden: false,
    schema: undefined,
    selectorFor: undefined,
    value: undefined,
    type: SlotType.STRING,
  };

  static readonly DEFAULT_OMS_INTEGRATIONS_CONTEXT: Record<string, any> = {
    [Constants.SESSION_VARIABLE_OMS_JWT]: undefined,
    [Constants.SESSION_VARIABLE_ENTERPRISE_CODE]: '',
    [Constants.SESSION_VARIABLE_ENTERPRISE_LIST]: undefined,
    [Constants.SESSION_VARIABLE_CURRENT_ORDER_NO]: '',
    [Constants.SESSION_VARIABLE_CURRENT_ORDER]: undefined,
  };

  static readonly GET_PAGE_PAGINATION_DEFAULTS: PaginationParams = {
    PageNumber: 1,
    PageSize: 999,
    PaginationStrategy: 'GENERIC',
    Refresh: 'N',
  };
}
