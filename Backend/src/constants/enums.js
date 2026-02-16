export const MESSAGE_TYPES = {
  LEAD: 'lead',
  OFFERING: 'offering',
  NOISE: 'noise'
};

export const ACTOR_TYPES = {
  DEALER: 'dealer',
  DISTRIBUTOR: 'distributor',
  UNKNOWN: 'unknown'
};

export const CONDITION_TYPES = {
  FRESH: 'fresh',
  USED: 'used',
  UNKNOWN: 'unknown'
};

export const DISPATCH_TYPES = {
  TODAY: 'today',
  TOMORROW: 'tomorrow',
  UNKNOWN: 'unknown'
};

export const DB_TABLES = {
  DEALER_LEADS: 'dealer_leads',
  DISTRIBUTOR_OFFERINGS: 'distributor_offerings',
  IGNORED_MESSAGES: 'ignored_messages',
  MESSAGE_REPLIES: 'message_replies',
  OPENAI_USAGE_LOGS: 'openai_usage_logs'
};
