import { getSupabase } from '../config/supabase.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Reply Storage');

/**
 * Store reply data in message_replies table
 * @param {Object} replyData - Reply data from extractor
 * @returns {Promise<boolean>} Success status
 */
export const storeReplyData = async (replyData) => {
  try {
    const {
      replied_by,
      replied_by_name,
      replied_message,
      replied_at,
      quoted_message_id,
      quoted_message_text,
      chat_type,
      source
    } = replyData;

    const supabase = getSupabase();
    const { error } = await supabase
      .from('message_replies')
      .insert({
        replied_by,
        replied_by_name,
        replied_message,
        replied_at,
        quoted_message_id,
        quoted_message_text,
        chat_type,
        source: source || 'whatsapp'
      });

    if (error) {
      logger.error('Failed to store reply data', { error, replied_by, quoted_message_id });
      return false;
    }

    logger.info('Reply data stored successfully', {
      replied_by,
      quoted_message_id,
      chat_type
    });

    return true;

  } catch (error) {
    logger.error('Error storing reply data', { error });
    return false;
  }
};
