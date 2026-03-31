import { getSupabaseChat } from '../config/supabase-chat.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Insert to Supabase');

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

export const insertToSupabaseDB = async (items) => {
  const results = [];

  for (const item of items) {
    try {
      const routeTo = item.__routeTo || 'ignored_messages';
      let payload;

      switch (routeTo) {
        case 'dealer_leads':
          payload = buildDealerLeadPayload(item);
          break;
        case 'distributor_offerings':
          payload = buildDistributorOfferingPayload(item);
          break;
        case 'message_replies':
          payload = buildMessageReplyPayload(item);
          break;
        case 'openai_usage_logs':
          // Skip OpenAI usage logs for now
          logger.info('Skipping OpenAI usage log entry');
          results.push({
            ...item,
            __inserted: true,
            __skipped: true,
            __reason: 'OpenAI usage logging disabled'
          });
          continue;
        case 'ignored_messages':
        default:
          payload = buildIgnoredMessagePayload(item);
          break;
      }

      // Skip if no valid data
      const validFields = Object.values(payload).filter(value => value !== null && value !== undefined);
      if (validFields.length === 0) {
        logger.warn(`No valid data to insert for ${routeTo}`);
        results.push({
          ...item,
          __insertError: 'No valid data to insert'
        });
        continue;
      }

      // Insert into Supabase based on route
      let insertedId = null;
      const supabase = getSupabaseChat();
      
      if (routeTo === 'dealer_leads') {
        // Insert into dealer_leads table
        const { data, error } = await supabase
          .from('dealer_leads')
          .insert(payload)
          .select('id')
          .single();
        
        if (error) {
          throw error;
        }
        insertedId = data.id;
        
      } else if (routeTo === 'distributor_offerings') {
        // Insert into distributor_offerings table
        const { data, error } = await supabase
          .from('distributor_offerings')
          .insert(payload)
          .select('id')
          .single();
        
        if (error) {
          throw error;
        }
        insertedId = data.id;
        
      } else if (routeTo === 'message_replies') {
        // Insert into message_replies table
        const { data, error } = await supabase
          .from('message_replies')
          .insert(payload)
          .select('id')
          .single();
        
        if (error) {
          throw error;
        }
        insertedId = data.id;
        
      } else {
        // Default to ignored_messages
        const { data, error } = await supabase
          .from('ignored_messages')
          .insert(payload)
          .select('id')
          .single();
        
        if (error) {
          throw error;
        }
        insertedId = data.id;
      }

      // Log successful insertion
      logger.info(`✅ Successfully saved to Supabase`, {
        table: routeTo,
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

    } catch (error) {
      logger.error(`Supabase insert error for table ${item.__routeTo || 'ignored_messages'}`, error);
      results.push({
        ...item,
        __insertError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
};
