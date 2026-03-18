import { createLogger } from '../utils/logger.js';
import { chatRepository } from '../repositories/chatRepository.js';

const logger = createLogger('ProfileService');

// Rate limiting for profile picture fetching
let profileFetchCount = 0;
let lastResetTime = Date.now();
const MAX_FETCHES_PER_MINUTE = 1; // Conservative limit

function canFetchProfilePic() {
  const now = Date.now();
  
  // Reset counter every minute
  if (now - lastResetTime > 60000) {
    profileFetchCount = 0;
    lastResetTime = now;
  }
  
  if (profileFetchCount >= MAX_FETCHES_PER_MINUTE) {
    logger.warn('Profile picture fetch rate limit exceeded', { 
      count: profileFetchCount, 
      limit: MAX_FETCHES_PER_MINUTE 
    });
    return false;
  }
  
  profileFetchCount++;
  return true;
}

/**
 * Fetch WhatsApp profile picture URL using Baileys
 * @param {Object} sock - Baileys socket instance
 * @param {string} jid - WhatsApp JID (@s.whatsapp.net only)
 * @returns {Promise<string|null>} Profile picture URL or null if not available
 */
export async function fetchProfilePicture(sock, jid, contact = null) {
  try {
    // Only fetch for @s.whatsapp.net user JIDs, exclude @lid, @g.us, @broadcast
    if (!jid || !jid.endsWith('@s.whatsapp.net')) {
      logger.debug('Skipping profile pic fetch for non-@s.whatsapp.net JID', { jid });
      return null;
    }

    // Rate limiting check
    if (!canFetchProfilePic()) {
      logger.warn('Profile picture fetch blocked by rate limit', { jid });
      return null;
    }

    // Skip if contact already has profile picture
    if (contact && contact.profile_pic_url) {
      logger.debug('Skipping - contact already has profile picture', { jid });
      return null;
    }

    // Skip if contact hasn't messaged you (if we have that info)
    if (contact && !contact.has_messaged_you) {
      logger.debug('Skipping - contact has not messaged you', { jid });
      return null;
    }

    // Random delay to look human-like (2-5 seconds)
    const randomDelay = 2000 + Math.random() * 3000;
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    logger.debug('Fetching profile picture', { jid });
    
    // Use Baileys built-in profilePictureUrl method
    const url = await sock.profilePictureUrl(jid, 'image');
    
    if (url) {
      logger.info('Profile picture fetched successfully', { jid, url });
    } else {
      logger.info('No profile picture available', { jid });
    }
    
    return url;
  } catch (error) {
    // Don't retry on these specific errors - they're permanent
    if (error.message === 'not-authorized') {
      logger.debug('Profile picture not authorized (privacy settings)', { jid });
    } else if (error.message === 'item-not-found') {
      logger.debug('No profile picture exists', { jid });
    } else {
      logger.error('Profile picture fetch failed', { jid, error: error.message });
    }
    return null;
  }
}

/**
 * Check if profile picture should be fetched for this contact
 * @param {Object} contact - Contact object from database
 * @returns {boolean} Whether to fetch profile picture
 */
export function shouldFetchProfilePicture(contact) {
  return (
    contact &&
    contact.primary_jid && // Must have primary_jid
    !contact.profile_pic_url // Only check if no URL exists (regardless of fetched flag)
  );
}
