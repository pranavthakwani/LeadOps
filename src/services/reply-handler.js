import { getSupabase } from '../config/supabase.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Reply Handler');

/**
 * Find the original message that was replied to
 * @param {string} quotedMessageId - WhatsApp message ID of the quoted message
 * @returns {Promise<Object|null>} - Original message info or null if not found
 */
export const findOriginalMessage = async (quotedMessageId) => {
  const supabase = getSupabase();
  
  try {
    // Search in dealer_leads first
    const { data: leadData, error: leadError } = await supabase
      .from('dealer_leads')
      .select('id, wa_message_id')
      .eq('wa_message_id', quotedMessageId)
      .single();

    if (leadData && !leadError) {
      return {
        table: 'dealer_leads',
        rowId: leadData.id,
        waMessageId: leadData.wa_message_id
      };
    }

    // Search in distributor_offerings
    const { data: offeringData, error: offeringError } = await supabase
      .from('distributor_offerings')
      .select('id, wa_message_id')
      .eq('wa_message_id', quotedMessageId)
      .single();

    if (offeringData && !offeringError) {
      return {
        table: 'distributor_offerings',
        rowId: offeringData.id,
        waMessageId: offeringData.wa_message_id
      };
    }

    return null;
  } catch (error) {
    logger.error('Error finding original message', { quotedMessageId, error });
    return null;
  }
};

/**
 * Save a reply to the database
 * @param {Object} replyData - Reply information
 * @returns {Promise<Object|null>} - Inserted record or null if failed
 */
export const saveReply = async (replyData) => {
  const supabase = getSupabase();
  
  try {
    const { data, error } = await supabase
      .from('message_replies')
      .insert([{
        original_table: replyData.originalTable,
        original_row_id: replyData.originalRowId,
        original_wa_message_id: replyData.originalWaMessageId,
        reply_wa_message_id: replyData.replyWaMessageId,
        contact_number: replyData.contactNumber,
        contact_name: replyData.contactName || null,
        reply_text: replyData.replyText
      }])
      .select()
      .single();

    if (error) {
      // Check for duplicate reply_wa_message_id
      if (error.code === '23505') {
        logger.warn('Duplicate reply ignored', { replyWaMessageId: replyData.replyWaMessageId });
        return null;
      }
      throw error;
    }

    logger.info('Reply saved successfully', { 
      replyId: data.id,
      originalTable: replyData.originalTable,
      contactNumber: replyData.contactNumber
    });

    return data;
  } catch (error) {
    logger.error('Error saving reply', { replyData, error });
    return null;
  }
};

/**
 * Process a potential reply message
 * @param {Object} replyData - Reply data object
 * @returns {Promise<boolean>} - True if reply was processed, false otherwise
 */
export async function processReply(replyData) {
  try {
    logger.info('Processing reply', { replyData });

    const {
      replied_by,
      replied_by_name,
      reply_text,
      quoted_message_id,
      quoted_message_text
    } = replyData;

    // Check if this is a quoted reply from a broadcast
    if (quoted_message_id && quoted_message_text) {
      // This is a quoted reply - store in message_replies table
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('message_replies')
        .insert({
          replied_by,
          replied_by_name,
          replied_message: reply_text,
          quoted_message_id,
          quoted_message_text,
          chat_type: 'private',
          source: 'whatsapp'
        })
        .select()
        .single();

      if (error) {
        logger.error('Error saving quoted reply', { error });
        return false;
      }

      logger.info('Quoted reply saved successfully', { replyId: data.id });
      return true;
    } else {
      // This is not a quoted reply - store in other table (you'll need to create this table)
      logger.info('Non-quoted reply received', { 
        replied_by, 
        reply_text,
        note: 'Create separate table for non-quoted replies if needed'
      });
      
      // TODO: Add logic to store non-quoted replies in a different table
      // For now, we just log it
      
      return false;
    }

  } catch (error) {
    logger.error('Error processing reply', { error });
    return false;
  }
};
