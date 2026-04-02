import { createLogger } from '../utils/logger.js';

const logger = createLogger('ProfilePicService');

// 🔥 GLOBAL QUEUE (MANDATORY)
let profilePicQueue = [];
let isProcessingQueue = false;

// 🔥 RANDOM DELAY (VERY IMPORTANT)
// Random delay around 1 minute (55-65 seconds) to avoid rate limiting
function getRandomDelay() {
  const min = 55000;  // 55 seconds
  const max = 65000;  // 65 seconds (around 1 minute with randomness)
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 🔴 DELAY FUNCTION
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 🔧 GET WHATSAPP SOCKET
function getWASocket() {
  return global.baileysSock || null;
}

// 🔧 FETCH FUNCTION
async function fetchAndStoreProfilePic({ contactId, jid }) {
  logger.info('fetchAndStoreProfilePic called:', { contactId, jid });
  
  try {
    // Import repositories dynamically to avoid circular dependencies
    const { supabaseChatRepository } = await import('../repositories/supabase-chatRepository.js');
    
    const contact = await supabaseChatRepository.getContactById(contactId);
    if (!contact) {
      logger.warn('Contact not found for profile pic fetch:', { contactId });
      return;
    }

    const sock = getWASocket();
    if (!sock) {
      logger.warn('WhatsApp socket not available for profile pic fetch');
      return;
    }

    // Fetch profile pics for @s.whatsapp.net AND @lid (exclude @g.us, @broadcast)
    if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) {
      logger.debug('Skipping non-eligible JID profile pic fetch:', { jid });
      return;
    }

    logger.info('Attempting to fetch profile pic:', { jid, contactId });
    try {
      const url = await sock.profilePictureUrl(jid, 'image');
      logger.info('Profile pic fetched successfully:', { jid, url });

      // Update with success
      const updateResult = await supabaseChatRepository.updateContactProfilePic(contactId, {
        profile_pic_url: url,
        profile_pic_fetched: true,
        profile_pic_last_updated: new Date()
      });
      
      logger.info('Database update result:', { contactId, updateResult, url });
      
      logger.info('Profile pic updated:', { contactId, jid, url });

    } catch (fetchErr) {
      logger.warn('Profile pic not available:', { jid, error: fetchErr.message });
      
      // Update with failure to prevent infinite retries
      const failureUpdateResult = await supabaseChatRepository.updateContactProfilePic(contactId, {
        profile_pic_url: null,
        profile_pic_fetched: true,
        profile_pic_last_updated: new Date()
      });
      
      logger.info('Database failure update result:', { contactId, failureUpdateResult });
    }

  } catch (err) {
    logger.error('Profile pic fetch failed:', { 
      error: err.message, 
      contactId, 
      jid 
    });
  }
}

// 🔴 PROCESS QUEUE (CRITICAL)
async function processQueue() {
  if (isProcessingQueue) {
    logger.debug('Queue already processing, skipping');
    return;
  }

  isProcessingQueue = true;
  logger.info('Starting profile pic queue processing', { 
    queueLength: profilePicQueue.length,
    queueItems: profilePicQueue.map(item => ({ contactId: item.contactId, jid: item.jid }))
  });

  while (profilePicQueue.length > 0) {
    const item = profilePicQueue.shift();
    logger.info('Processing profile pic from queue:', { 
      contactId: item.contactId, 
      jid: item.jid,
      remaining: profilePicQueue.length 
    });

    try {
      await fetchAndStoreProfilePic(item);
    } catch (err) {
      logger.error('Profile pic queue item failed:', err);
    }

    // 🔥 RANDOM DELAY (IMPORTANT)
    if (profilePicQueue.length > 0) {
      const delayMs = getRandomDelay();
      logger.info(`Waiting ${delayMs}ms before next profile pic fetch`);
      await delay(delayMs);
    }
  }

  isProcessingQueue = false;
  logger.info('Profile pic queue processing completed');
}

// 🔧 ADD TO QUEUE LOGIC
export function enqueueProfilePicFetch(contact) {
  if (!contact.primary_jid) {
    return;
  }

  // Only fetch @s.whatsapp.net AND @lid numbers (exclude @g.us, @broadcast)
  if (!contact.primary_jid.endsWith('@s.whatsapp.net') && !contact.primary_jid.endsWith('@lid')) {
    return;
  }

  // 🔴 CRITICAL: CHECK 30-DAY RULE BEFORE ANYTHING ELSE
  // 🔴 FALLBACK: Handle missing database columns
  const profileFetched = contact.profile_pic_fetched === true;
  const lastUpdated = contact.profile_pic_last_updated;
  
  const shouldFetch =
    !profileFetched ||
    !lastUpdated ||
    Date.now() - new Date(lastUpdated).getTime() > 30 * 24 * 60 * 60 * 1000;
    
  if (!shouldFetch) {
    logger.info('🛑 Profile pic fetch blocked - recently fetched (30-day rule):', { 
      contactId: contact.id,
      lastUpdated: lastUpdated,
      daysSince: Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (24 * 60 * 60 * 1000)),
      profile_pic_fetched: profileFetched
    });
    return;
  }

  // 🔴 PREVENT DUPLICATE QUEUE ENTRIES
  const alreadyQueued = profilePicQueue.find(
    item => item.contactId === contact.id
  );

  if (alreadyQueued) {
    return;
  }

  logger.info('✅ Profile pic fetch allowed - adding to queue:', { 
    contactId: contact.id,
    reason: contact.profile_pic_fetched !== true ? 'never fetched' : 'older than 30 days'
  });

  profilePicQueue.push({
    contactId: contact.id,
    jid: contact.primary_jid
  });

  // Start processing if not already running
  processQueue();
}

// 🔧 GET QUEUE STATUS (for debugging)
export function getProfilePicQueueStatus() {
  return {
    queueLength: profilePicQueue.length,
    isProcessing: isProcessingQueue,
    queueItems: profilePicQueue.map(item => ({
      contactId: item.contactId,
      jid: item.jid
    }))
  };
}

// 🔧 CLEAR QUEUE (for emergency)
export function clearProfilePicQueue() {
  profilePicQueue = [];
  isProcessingQueue = false;
  logger.warn('Profile pic queue cleared');
}

export default {
  enqueueProfilePicFetch,
  getProfilePicQueueStatus,
  clearProfilePicQueue
};
