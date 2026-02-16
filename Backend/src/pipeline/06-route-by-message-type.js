import { MESSAGE_TYPES, DB_TABLES } from '../constants/enums.js';

export const routeByMessageType = (items) => {
  return items.map(item => {
    let routeTo = null;

    switch (item.message_type) {
      case MESSAGE_TYPES.LEAD:
        routeTo = DB_TABLES.DEALER_LEADS;
        break;
      case MESSAGE_TYPES.OFFERING:
        routeTo = DB_TABLES.DISTRIBUTOR_OFFERINGS;
        break;
      case MESSAGE_TYPES.NOISE:
      default:
        routeTo = DB_TABLES.IGNORED_MESSAGES;
        break;
    }

    return {
      ...item,
      __routeTo: routeTo
    };
  });
};
