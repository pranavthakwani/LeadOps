import { getSQLPool } from '../config/sqlserver.js';
import { DB_TABLES } from '../constants/enums.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Insert to SQL Server DB');

const buildDealerLeadPayload = (item) => {
  return {
    wa_message_id: item.wa_message_id || null,
    sender: item.source?.sender || null,
    chat_id: item.source?.chat_id || null,
    chat_type: item.source?.chat_type || null,
    brand: item.brand || null,
    model: item.model || null,
    variant: item.variant || null,
    ram: item.ram || null,
    storage: item.storage || null,
    colors: typeof item.colors === 'object' && item.colors !== null ? JSON.stringify(item.colors) : null,
    quantity: Number.isInteger(item.quantity) ? item.quantity : null,
    price: typeof item.price === 'number' ? item.price : null,
    condition: item.condition || null,
    gst: item.gst === true ? 1 : item.gst === false ? 0 : null,
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
    wa_message_id: item.wa_message_id || null,
    sender: item.source?.sender || null,
    chat_id: item.source?.chat_id || null,
    chat_type: item.source?.chat_type || null,
    confidence: item.confidence || 0,
    raw_message: item.source?.raw_message || null
  };
};

const buildMessageReplyPayload = (item) => {
  return {
    replied_by: item.replied_by || null,
    replied_by_name: item.replied_by_name || null,
    replied_message: item.replied_message || null,
    replied_at: item.replied_at || new Date().toISOString(),
    quoted_message_id: item.quoted_message_id || null,
    quoted_message_text: item.quoted_message_text || null,
    chat_type: item.chat_type || null,
    source: item.source || 'whatsapp'
  };
};

const buildOpenAIUsageLogPayload = (item) => {
  return {
    wa_message_id: item.wa_message_id || null,
    model: item.model || null,
    input_tokens: item.input_tokens || null,
    output_tokens: item.output_tokens || null,
    total_tokens: item.total_tokens || null,
    cost_input_usd: item.cost_input_usd || null,
    cost_output_usd: item.cost_output_usd || null,
    cost_total_usd: item.cost_total_usd || null,
    latency_ms: item.latency_ms || null,
    raw_message: item.raw_message || null
  };
};

export const insertToSQLServerDB = async (items) => {
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
        case DB_TABLES.MESSAGE_REPLIES:
          payload = buildMessageReplyPayload(item);
          break;
        case DB_TABLES.OPENAI_USAGE_LOGS:
          payload = buildOpenAIUsageLogPayload(item);
          break;
        case DB_TABLES.IGNORED_MESSAGES:
        default:
          payload = buildIgnoredMessagePayload(item);
          break;
      }

      const pool = getSQLPool();

      // Build dynamic INSERT query based on payload
      const columns = Object.keys(payload).filter(key => payload[key] !== null && payload[key] !== undefined);
      const values = columns.map(key => payload[key]);
      
      if (columns.length === 0) {
        logger.warn(`No valid columns to insert for ${table}`);
        results.push({
          ...item,
          __insertError: 'No valid data to insert'
        });
        continue;
      }

      const placeholders = columns.map((_, index) => `@param${index}`).join(', ');
      const columnNames = columns.join(', ');
      
      const query = `
        INSERT INTO ${table} (${columnNames})
        OUTPUT INSERTED.id
        VALUES (${placeholders})
      `;

      // Create parameterized request
      const request = pool.request();
      values.forEach((value, index) => {
        request.input(`param${index}`, value);
      });

      const result = await request.query(query);
      
      if (result.recordset && result.recordset.length > 0) {
        const insertedId = result.recordset[0].id;
        
        // Log detailed information about what was saved
        logger.info(`✅ Successfully saved to database`, {
          table: table,
          insertedId: insertedId,
          savedData: {
            sender: payload.sender || 'N/A',
            chat_id: payload.chat_id || 'N/A',
            brand: payload.brand || 'N/A',
            model: payload.model || 'N/A',
            quantity: payload.quantity || payload.quantity_max || 'N/A',
            price: payload.price || payload.price_max || 'N/A',
            confidence: payload.confidence || 'N/A'
          }
        });
        
        results.push({
          ...item,
          __inserted: true,
          __insertedId: insertedId
        });
      } else {
        throw new Error('No ID returned from INSERT operation');
      }

    } catch (error) {
      logger.error(`SQL Server DB insert error for table ${item.__routeTo || DB_TABLES.IGNORED_MESSAGES}`, error);
      results.push({
        ...item,
        __insertError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
};
