import { createLogger } from '../utils/logger.js';

const logger = createLogger('Reply Extractor');

/**
 * Extract structured data from WhatsApp reply message
 * @param {Object} replyData - WhatsApp reply message data
 * @returns {Object} Structured reply data or error
 */
export const extractReplyData = (replyData) => {
  try {
    const {
      replied_by,
      sender,
      body,
      timestamp,
      hasQuotedMsg,
      quotedMsg
    } = replyData;

    // Validate input is a reply message
    if (!hasQuotedMsg || !quotedMsg) {
      return { error: 'not_a_reply_message' };
    }

    // Extract quoted message data
    const quoted_message_id = quotedMsg?.id?._serialized || null;
    const quoted_message_text = quotedMsg?.body || null;

    // Determine chat type
    let chat_type = 'personal';
    if (sender?.isGroup) {
      chat_type = 'group';
    } else if (sender?.isBroadcast) {
      chat_type = 'broadcast_reply';
    }

    // Get contact name
    const replied_by_name = sender?.pushname || sender?.formattedName || null;

    // Format timestamp
    const replied_at = timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();

    // Deal linking logic
    const deal_linked = quoted_message_id !== null;
    const interest_confidence = deal_linked ? 1.0 : 0.0;

    const result = {
      replied_by,
      replied_by_name,
      replied_message: body || '',
      replied_at,
      quoted_message_id,
      quoted_message_text,
      chat_type,
      source: 'whatsapp',
      deal_linked,
      interest_confidence
    };

    return result;

  } catch (error) {
    logger.error('Error extracting reply data', { error });
    return { error: error instanceof Error ? error.message : String(error) };
  }
};
