/**
 * Centralized JID parsing utility
 * Handles all WhatsApp JID types safely
 */

export function parseJid(jid) {
  if (!jid || typeof jid !== 'string') {
    return { type: 'unknown', phone: null, jid: jid || null };
  }

  if (jid.endsWith('@s.whatsapp.net')) {
    const phone = jid.split('@')[0];
    return {
      type: 'user',
      phone: phone || null,
      jid
    };
  }

  if (jid.endsWith('@g.us')) {
    return {
      type: 'group',
      phone: null,
      jid
    };
  }

  if (jid.endsWith('@broadcast')) {
    return {
      type: 'broadcast',
      phone: null,
      jid
    };
  }

  return {
    type: 'unknown',
    phone: null,
    jid
  };
}

/**
 * Extract phone number safely from JID
 * Only returns phone for user JIDs
 */
export function extractPhoneFromJid(jid) {
  const { type, phone } = parseJid(jid);
  return type === 'user' ? phone : null;
}

/**
 * Check if JID is a user (individual contact)
 */
export function isUserJid(jid) {
  return parseJid(jid).type === 'user';
}

/**
 * Check if JID is a group
 */
export function isGroupJid(jid) {
  return parseJid(jid).type === 'group';
}

/**
 * Check if JID is a broadcast
 */
export function isBroadcastJid(jid) {
  return parseJid(jid).type === 'broadcast';
}
