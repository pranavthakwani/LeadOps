import { getSupabase } from '../config/supabase.js';
import { DB_TABLES } from '../constants/enums.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Insert to DB');

const buildDealerLeadPayload = (item) => {
  return {
    sender: item.source?.sender || null,
    chat_id: item.source?.chat_id || null,
    chat_type: item.source?.chat_type || null,
    brand: item.brand || null,
    model: item.model || null,
    variant: item.variant || null,
    ram: item.ram || null,
    storage: item.storage || null,
    colors: typeof item.colors === 'object' && item.colors !== null ? item.colors : {},
    quantity: Number.isInteger(item.quantity) ? item.quantity : null,
    price: typeof item.price === 'number' ? item.price : null,
    condition: item.condition || null,
    gst: item.gst === true ? true : item.gst === false ? false : null,
    dispatch: item.dispatch || null,
    confidence: item.confidence || 0,
    raw_message: item.source?.raw_message || null,
    price_min: item.price_min !== null && item.price_min !== undefined ? item.price_min : (typeof item.price === 'number' ? item.price : null),
    price_max: item.price_max !== null && item.price_max !== undefined ? item.price_max : (typeof item.price === 'number' ? item.price : null),
    quantity_min: item.quantity_min !== null && item.quantity_min !== undefined ? item.quantity_min : (Number.isInteger(item.quantity) ? item.quantity : null),
    quantity_max: item.quantity_max !== null && item.quantity_max !== undefined ? item.quantity_max : (Number.isInteger(item.quantity) ? item.quantity : null)
  };
};

const buildDistributorOfferingPayload = (item) => {
  return buildDealerLeadPayload(item);
};

const buildIgnoredMessagePayload = (item) => {
  return {
    sender: item.source?.sender || null,
    chat_id: item.source?.chat_id || null,
    chat_type: item.source?.chat_type || null,
    confidence: item.confidence || 0,
    raw_message: item.source?.raw_message || null
  };
};

export const insertToDB = async (items) => {
  const supabase = getSupabase();
  const results = [];

  for (const item of items) {
    try {
      const table = item.__routeTo || DB_TABLES.IGNORED_MESSAGES;
      let payload;

      switch (table) {
        case DB_TABLES.DEALER_LEADS:
          payload = buildDealerLeadPayload(item);
          break;
        case DB_TABLES.DISTRIBUTOR_OFFERINGS:
          payload = buildDistributorOfferingPayload(item);
          break;
        case DB_TABLES.IGNORED_MESSAGES:
        default:
          payload = buildIgnoredMessagePayload(item);
          break;
      }

      const { data, error } = await supabase
        .from(table)
        .insert([payload])
        .select();

      if (error) {
        logger.error(`Failed to insert into ${table}`, error);
        results.push({
          ...item,
          __insertError: error.message
        });
      } else {
        logger.info(`Inserted into ${table}`, { id: data?.[0]?.id });
        results.push({
          ...item,
          __inserted: true,
          __insertedId: data?.[0]?.id
        });
      }

    } catch (error) {
      logger.error('DB insert error', error);
      results.push({
        ...item,
        __insertError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
};
