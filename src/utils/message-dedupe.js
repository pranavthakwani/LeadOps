const processedMessages = new Set();

/**
 * Check if message has already been processed
 * @param {string} wa_message_id - WhatsApp message ID
 * @returns {Promise<boolean>} - True if already processed
 */
export const isMessageAlreadyProcessed = async (wa_message_id) => {
  if (!wa_message_id || wa_message_id === 'unknown') {
    return false;
  }
  return processedMessages.has(wa_message_id);
};

/**
 * Mark message as processed
 * @param {string} wa_message_id - WhatsApp message ID
 */
export const markMessageAsProcessed = (wa_message_id) => {
  if (wa_message_id && wa_message_id !== 'unknown') {
    processedMessages.add(wa_message_id);
  }
};

/**
 * Clear processed messages (for testing or restart)
 */
export const clearProcessedMessages = () => {
  processedMessages.clear();
};
