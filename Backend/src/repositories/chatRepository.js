import sql from 'mssql';
import { getSQLPool } from '../config/sqlserver.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ChatRepository');

// DB safety wrapper
async function safeQuery(fn, operation = 'database operation') {
  try {
    return await fn();
  } catch (err) {
    logger.error(`DB query failed: ${operation}`, { 
      error: err.message,
      stack: err.stack 
    });
    return null;
  }
}

export const chatRepository = {

  async getOrCreateConversation(jid) {
    const pool = await getSQLPool();

    // Determine type
    let type = 'direct';
    if (jid.endsWith('@g.us')) type = 'group';
    if (jid.includes('@broadcast')) type = 'broadcast';

    try {
      // Try to insert first (optimistic approach)
      const inserted = await pool.request()
        .input('jid', sql.NVarChar, jid)
        .input('type', sql.NVarChar, type)
        .query(`
          INSERT INTO conversations (jid, type, created_at)
          OUTPUT INSERTED.id
          VALUES (@jid, @type, GETUTCDATE())
        `);

      const conversationId = inserted.recordset[0].id;

      // Auto-link to existing contact if phone number matches
      if (type === 'direct' && jid.endsWith('@s.whatsapp.net')) {
        const phone = jid.replace('@s.whatsapp.net', '');
        const existingContact = await pool.request()
          .input('phone', sql.NVarChar, phone)
          .query(`
            SELECT id FROM contacts WHERE phone_number = @phone
          `);

        if (existingContact.recordset.length > 0) {
          await this.linkContact(conversationId, existingContact.recordset[0].id);
          console.log(`Auto-linked conversation ${conversationId} to existing contact ${existingContact.recordset[0].id}`);
        }
      }

      return conversationId;

    } catch (err) {
      // If duplicate (race condition), fetch existing
      if (err.number === 2601 || err.number === 2627) { // Unique constraint violation
        const existing = await pool.request()
          .input('jid', sql.NVarChar, jid)
          .query(`
            SELECT id FROM conversations WHERE jid = @jid
          `);

        if (existing.recordset.length > 0) {
          return existing.recordset[0].id;
        }
      }
      
      // Re-throw if it's not a duplicate constraint error
      throw err;
    }
  },

  async insertMessage(data) {
    return await safeQuery(async () => {
      const pool = await getSQLPool();

      // Check if message already exists
      const existingMessage = await pool.request()
        .input('waMessageId', sql.NVarChar, data.waMessageId)
        .query(`
          SELECT id FROM chat_messages 
          WHERE wa_message_id = @waMessageId
        `);

      if (existingMessage.recordset.length > 0) {
        console.log('Message already exists, skipping insert:', data.waMessageId);
        
        // Still need to return conversationId for socket emission
        // Find the conversation for this JID
        const conversation = await this.getOrCreateConversation(data.jid);
        return conversation; // Return conversation_id for socket emission
      }

      // 1️⃣ Get or create conversation
      const conversationId = await this.getOrCreateConversation(data.jid);

      // 2️⃣ Insert the message with full raw message
      const request = pool.request()
        .input('jid', sql.NVarChar, data.jid)
        .input('conversationId', sql.Int, conversationId)
        .input('waMessageId', sql.NVarChar, data.waMessageId)
        .input('fromMe', sql.Bit, data.fromMe)
        .input('text', sql.NVarChar(sql.MAX), data.text)
        .input('timestamp', sql.BigInt, data.timestamp)
        .input('quotedMessageId', sql.NVarChar, data.quotedMessageId || null)
        .input('quotedText', sql.NVarChar(sql.MAX), data.quotedText || null)
        .input('quotedSender', sql.NVarChar, data.quotedSender || null)
        .input('rawMessage', sql.NVarChar(sql.MAX), data.rawMessage || null)
        .query(`
          INSERT INTO chat_messages (
            jid,
            conversation_id,
            wa_message_id,
            from_me,
            message_text,
            message_timestamp,
            created_at,
            quoted_message_id,
            quoted_text,
            quoted_sender,
            raw_message
          )
          VALUES (
            @jid,
            @conversationId,
            @waMessageId,
            @fromMe,
            @text,
            @timestamp,
            GETUTCDATE(),
            @quotedMessageId,
            @quotedText,
            @quotedSender,
            @rawMessage
          )
        `);

      // 3️⃣ Update conversation metadata and unread count
      const updateQuery = data.fromMe === 0 
        ? `
          UPDATE conversations
          SET last_message_at = @timestamp,
              unread_count = ISNULL(unread_count, 0) + 1
          WHERE id = @conversationId
        `
        : `
          UPDATE conversations
          SET last_message_at = @timestamp
          WHERE id = @conversationId
        `;

      await pool.request()
        .input('conversationId', sql.Int, conversationId)
        .input('timestamp', sql.BigInt, data.timestamp)
        .query(updateQuery);

      return conversationId; // Return conversation_id for socket emission
    }, 'insertMessage');
  },

  async getMessageById(messageId) {
    const pool = await getSQLPool();

    const result = await pool.request()
      .input('messageId', sql.NVarChar, messageId)
      .query(`
        SELECT 
          id,
          wa_message_id,
          message_text,
          from_me,
          message_timestamp,
          jid,
          raw_message
        FROM chat_messages
        WHERE wa_message_id = @messageId
      `);

    return result.recordset[0] || null;
  },

  async getConversationByJid(jid) {
    const pool = await getSQLPool();

    const result = await pool.request()
      .input('jid', sql.NVarChar, jid)
      .query(`
        SELECT id, jid, type, contact_id
        FROM conversations
        WHERE jid = @jid
      `);

    return result.recordset[0] || null;
  },

  async getMessagesByJid(jid) {
    const pool = await getSQLPool();

    const result = await pool.request()
      .input('jid', sql.NVarChar, jid)
      .query(`
        SELECT *
        FROM chat_messages
        WHERE jid = @jid
        ORDER BY message_timestamp ASC, id ASC
      `);

    return result.recordset;
  },

  async getMessagesByConversationId(conversationId) {
    const pool = await getSQLPool();

    const result = await pool.request()
      .input('conversationId', sql.Int, conversationId)
      .query(`
        SELECT 
          m.id,
          m.jid,
          m.conversation_id,
          m.wa_message_id,
          m.from_me,
          m.message_text,
          m.message_timestamp,
          m.created_at,
          m.quoted_message_id,
          COALESCE(m.quoted_text, q.message_text) AS quoted_text,
          m.quoted_sender,
          m.raw_message
        FROM chat_messages m
        LEFT JOIN chat_messages q
          ON m.quoted_message_id = q.wa_message_id
        WHERE m.conversation_id = @conversationId
        ORDER BY m.message_timestamp ASC, m.id ASC
      `);

    return result.recordset;
  },

  async linkContact(conversationId, contactId) {
    const pool = await getSQLPool();

    await pool.request()
      .input('conversationId', sql.Int, conversationId)
      .input('contactId', sql.Int, contactId)
      .query(`
        UPDATE conversations
        SET contact_id = @contactId
        WHERE id = @conversationId
      `);
  },

  async getOrCreateContactByPhone(phone, name = null) {
    const pool = await getSQLPool();

    if (!phone || phone.trim() === '') {
      throw new Error('Phone number is required');
    }

    const normalizedPhone = this.normalizePhone(phone);
    console.log('Looking for phone:', normalizedPhone);

    const existing = await pool.request()
      .input('phone', sql.NVarChar, normalizedPhone)
      .query(`
        SELECT id, display_name, is_auto_generated
        FROM contacts 
        WHERE phone_number = @phone
      `);

    if (existing.recordset.length > 0) {
      const contact = existing.recordset[0];
      console.log('Found existing contact:', contact.id);

      // Update contact if new pushName is available
      if (name && name !== 'Unknown' && name !== contact.display_name) {
        // Always update if display_name is 'Unknown' or null/empty
        // For auto-generated contacts, always update with new pushName
        // For manual contacts, only update if current name is 'Unknown' or null
        const shouldUpdate = 
          (contact.is_auto_generated === 1) || 
          (!contact.display_name || contact.display_name === 'Unknown' || contact.display_name === '');
          
        if (shouldUpdate) {
          console.log('Updating contact name:', contact.id, 'from', contact.display_name, 'to', name);
          await pool.request()
            .input('id', sql.Int, contact.id)
            .input('name', sql.NVarChar, name)
            .query(`
              UPDATE contacts
                SET display_name = @name
                WHERE id = @id
            `);
        }
      }

      return contact.id;
    }

    // Create new contact with is_auto_generated = 1 for auto-created contacts
    const inserted = await pool.request()
      .input('phone', sql.NVarChar, normalizedPhone)
      .input('name', sql.NVarChar, name || 'Unknown')
      .input('isAutoGenerated', sql.Bit, 1)
      .input('primaryJid', sql.NVarChar, `${normalizedPhone}@s.whatsapp.net`)
      .query(`
        INSERT INTO contacts (display_name, phone_number, is_auto_generated, primary_jid)
          OUTPUT INSERTED.id
          VALUES (@name, @phone, @isAutoGenerated, @primaryJid)
      `);

    console.log('Created new auto-generated contact:', inserted.recordset[0].id);
    return inserted.recordset[0].id;
  },

  // Update primary_jid for a contact (used when @lid JID is detected)
  async updatePrimaryJid(contactId, jid) {
    const pool = await getSQLPool();

    await pool.request()
      .input('contactId', sql.Int, contactId)
      .input('jid', sql.NVarChar, jid)
      .query(`
        UPDATE contacts
          SET primary_jid = @jid
          WHERE id = @contactId
      `);

    logger.info(`Primary JID updated for contact ${contactId}`, { jid });
  },

  async getConversationsWithContacts() {
    const pool = await getSQLPool();

    const result = await pool.request()
      .query(`
        SELECT 
            c.id,
            c.jid,
            c.type,
            c.last_message_at,
            c.unread_count,
            c.contact_id,
            ct.display_name,
            ct.phone_number,
            ct.profile_pic_url
        FROM conversations c
        LEFT JOIN contacts ct 
            ON c.contact_id = ct.id
        ORDER BY c.last_message_at DESC
      `);

    return result.recordset;
  },

  // Get contacts with conversations (paginated) - unique by contact
  async getContactsWithConversationsPaginated(offset = 0, limit = 30) {
    const pool = await getSQLPool();

    const result = await pool.request()
      .input('offset', offset)
      .input('limit', limit)
      .query(`
        WITH RankedConversations AS (
          SELECT 
            c.id,
            c.display_name,
            c.phone_number,
            c.is_auto_generated,
            c.profile_pic_url,
            conv.id as conversation_id,
            conv.last_message_at,
            conv.unread_count,
            last_msg.message_text as last_message_text,
            last_msg.from_me as last_message_from_me,
            ROW_NUMBER() OVER (
              PARTITION BY c.id 
              ORDER BY conv.last_message_at DESC
            ) as rn
          FROM contacts c
          INNER JOIN conversations conv 
            ON c.id = conv.contact_id
          LEFT OUTER JOIN (
            SELECT 
              cm.conversation_id,
              cm.message_text,
              cm.from_me,
              ROW_NUMBER() OVER (
                PARTITION BY cm.conversation_id 
                ORDER BY cm.message_timestamp DESC
              ) as rn
            FROM chat_messages cm
          ) last_msg ON conv.id = last_msg.conversation_id AND last_msg.rn = 1
        ),
        ContactsWithAllConvIds AS (
          SELECT 
            rc.id,
            rc.display_name,
            rc.phone_number,
            rc.is_auto_generated,
            rc.profile_pic_url,
            rc.conversation_id,
            rc.last_message_at,
            rc.unread_count,
            rc.last_message_text,
            rc.last_message_from_me,
            (
              SELECT CAST(STRING_AGG(CAST(conv.id AS VARCHAR), ',') AS VARCHAR)
              FROM conversations conv
              WHERE conv.contact_id = rc.id
            ) as all_conversation_ids
          FROM RankedConversations rc
          WHERE rc.rn = 1
        )
        SELECT 
          id,
          display_name,
          phone_number,
          is_auto_generated,
          profile_pic_url,
          conversation_id,
          last_message_at,
          unread_count,
          all_conversation_ids,
          last_message_text,
          last_message_from_me
        FROM ContactsWithAllConvIds
        ORDER BY last_message_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    return result.recordset;
  },

  // Get count of contacts with conversations (unique)
  async getContactsWithConversationsCount() {
    const pool = await getSQLPool();

    const result = await pool.request()
      .query(`
        SELECT COUNT(DISTINCT c.id) as count
        FROM contacts c
        INNER JOIN conversations conv 
          ON c.id = conv.contact_id
      `);

    return result.recordset[0].count;
  },

  // Get only one conversation per contact for the contacts list
  async getUniqueConversationsWithContacts() {
    const pool = await getSQLPool();

    const result = await pool.request()
      .query(`
        WITH RankedConversations AS (
          SELECT 
            c.id,
            c.jid,
            c.type,
            c.last_message_at,
            c.unread_count,
            c.contact_id,
            ct.display_name,
            ct.phone_number,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(c.contact_id, c.jid) 
              ORDER BY c.last_message_at DESC
            ) as rn
          FROM conversations c
          LEFT JOIN contacts ct 
            ON c.contact_id = ct.id
        )
        SELECT 
          id,
          jid,
          type,
          last_message_at,
          unread_count,
          contact_id,
          display_name,
          phone_number
        FROM RankedConversations
        WHERE rn = 1
        ORDER BY last_message_at DESC
      `);

    return result.recordset;
  },

  async resetUnreadCount(conversationId) {
    const pool = await getSQLPool();

    await pool.request()
      .input('conversationId', sql.Int, conversationId)
      .query(`
        UPDATE conversations
        SET unread_count = 0
        WHERE id = @conversationId
      `);
  },

  async updateContact(contactId, displayName, phoneNumber) {
    const pool = await getSQLPool();

    await pool.request()
      .input('contactId', sql.Int, contactId)
      .input('displayName', sql.NVarChar, displayName)
      .input('phoneNumber', sql.NVarChar, phoneNumber)
      .query(`
        UPDATE contacts
          SET display_name = @displayName,
              phone_number = @phoneNumber
          WHERE id = @contactId
      `);

    console.log('Updated contact:', contactId);
    return true;
  },

  // Phone normalization utility
  normalizePhone(phone) {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '');
  },

  // Generate JID from phone
  generateJid(phone) {
    return `${this.normalizePhone(phone)}@s.whatsapp.net`;
  },

  // Get all contacts with conversation info
  async getContactsWithConversations() {
    const pool = await getSQLPool();

    const result = await pool.request()
      .query(`
        SELECT 
          c.id,
          c.display_name,
          c.phone_number,
          c.is_auto_generated,
          c.profile_pic_url,
          conv.id as conversation_id,
          conv.last_message_at,
          conv.unread_count
        FROM contacts c
        LEFT JOIN conversations conv 
          ON c.id = conv.contact_id
        ORDER BY 
          CASE 
            WHEN conv.last_message_at IS NULL THEN 2 
            ELSE 1 
          END,
          conv.last_message_at DESC
      `);

    return result.recordset;
  },

  // Create new contact
  async createContact(displayName, phoneNumber) {
    const pool = await getSQLPool();
    
    const normalizedPhone = this.normalizePhone(phoneNumber);
    const primaryJid = `${normalizedPhone}@s.whatsapp.net`;

    const result = await pool.request()
      .input('displayName', sql.NVarChar, displayName)
      .input('phoneNumber', sql.NVarChar, normalizedPhone)
      .input('primaryJid', sql.NVarChar, primaryJid)
      .query(`
        INSERT INTO contacts (display_name, phone_number, primary_jid)
        VALUES (@displayName, @phoneNumber, @primaryJid);
        
        SELECT SCOPE_IDENTITY() as id;
      `);

    return result.recordset[0].id;
  },

  // Get conversation by contact ID
  async getConversationByContactId(contactId) {
    const pool = await getSQLPool();

    const result = await pool.request()
      .input('contactId', sql.Int, contactId)
      .query(`
        SELECT id FROM conversations 
        WHERE contact_id = @contactId
      `);

    return result.recordset[0]?.id || null;
  },

  // Create conversation for contact
  async createConversationForContact(contactId) {
    const pool = await getSQLPool();
    
    const result = await pool.request()
      .input('jid', sql.NVarChar, this.generateJid(contactId))
      .input('contactId', sql.Int, contactId)
      .query(`
        INSERT INTO conversations (jid, contact_id)
        VALUES (@jid, @contactId);
        
        SELECT SCOPE_IDENTITY() as id;
      `);

    return result.recordset[0].id;
  },

  // Get contact by ID
  async getContactById(contactId) {
    const pool = await getSQLPool();

    const result = await pool.request()
      .input('contactId', sql.Int, contactId)
      .query(`
        SELECT id, display_name, phone_number, profile_pic_url, profile_pic_fetched, primary_jid
        FROM contacts 
        WHERE id = @contactId
      `);

    return result.recordset[0] || null;
  },

  async getConversationByMessageId(messageId) {
    const pool = await getSQLPool();

    const result = await pool.request()
      .input('messageId', sql.Int, messageId)
      .query(`
        SELECT 
          cm.conversation_id,
          c.jid,
          c.contact_id,
          ct.display_name,
          ct.phone_number
        FROM chat_messages cm
        JOIN conversations c 
          ON cm.conversation_id = c.id
        LEFT JOIN contacts ct
          ON c.contact_id = ct.id
        WHERE cm.id = @messageId
      `);

    return result.recordset[0] || null;
  },

  // Link broadcast JID with WhatsApp JID under same contact
  async linkBroadcastWithWhatsApp(broadcastJid, phoneNumber) {
    const pool = await getSQLPool();
    
    // Generate WhatsApp JID from phone number
    const whatsappJid = this.generateJid(phoneNumber);
    
    // Get or create contact for this phone number
    const contactId = await this.getOrCreateContactByPhone(phoneNumber);
    
    // Get broadcast conversation
    const broadcastConv = await pool.request()
      .input('broadcastJid', sql.NVarChar, broadcastJid)
      .query(`
        SELECT id FROM conversations WHERE jid = @broadcastJid
      `);
    
    if (broadcastConv.recordset.length === 0) {
      throw new Error('Broadcast conversation not found');
    }
    
    const broadcastConvId = broadcastConv.recordset[0].id;
    
    // Get or create WhatsApp conversation
    let whatsappConvId;
    try {
      whatsappConvId = await this.getOrCreateConversation(whatsappJid);
    } catch (err) {
      // If WhatsApp conversation exists, get its ID
      const existingWhatsappConv = await pool.request()
        .input('whatsappJid', sql.NVarChar, whatsappJid)
        .query(`
          SELECT id FROM conversations WHERE jid = @whatsappJid
        `);
      
      if (existingWhatsappConv.recordset.length > 0) {
        whatsappConvId = existingWhatsappConv.recordset[0].id;
      } else {
        throw err;
      }
    }
    
    // Link both conversations to the same contact
    await pool.request()
      .input('broadcastConvId', sql.Int, broadcastConvId)
      .input('whatsappConvId', sql.Int, whatsappConvId)
      .input('contactId', sql.Int, contactId)
      .query(`
        UPDATE conversations 
        SET contact_id = @contactId 
        WHERE id IN (@broadcastConvId, @whatsappConvId)
      `);
    
    return {
      contactId,
      broadcastJid,
      whatsappJid,
      broadcastConvId,
      whatsappConvId
    };
  },

  // Get merged messages by contact ID (from all linked conversations)
  async getMergedMessagesByContactId(contactId) {
    const pool = await getSQLPool();

    const result = await pool.request()
      .input('contactId', sql.Int, contactId)
      .query(`
        SELECT 
          cm.id,
          cm.jid,
          cm.conversation_id,
          cm.wa_message_id,
          cm.from_me,
          cm.message_text,
          cm.message_timestamp,
          cm.created_at,
          cm.quoted_message_id,
          COALESCE(cm.quoted_text, q.message_text) AS quoted_text,
          cm.quoted_sender,
          c.type as conversation_type,
          c.jid as conversation_jid
        FROM chat_messages cm
        LEFT JOIN chat_messages q
          ON cm.quoted_message_id = q.wa_message_id
        JOIN conversations c ON cm.conversation_id = c.id
        WHERE c.contact_id = @contactId
        ORDER BY cm.message_timestamp ASC, cm.id ASC
      `);

    return result.recordset;
  },

  // Clean up duplicate conversations by linking them to existing contacts
  async cleanupDuplicateConversations() {
    const pool = await getSQLPool();

    // Find all conversations with phone numbers that could be linked
    const result = await pool.request()
      .query(`
        SELECT 
          c.id as conversation_id,
          c.jid,
          c.contact_id,
          ct.id as contact_id_from_table,
          ct.phone_number
        FROM conversations c
        LEFT JOIN contacts ct ON ct.phone_number = REPLACE(c.jid, '@s.whatsapp.net', '')
        WHERE c.jid LIKE '%@s.whatsapp.net'
        AND c.contact_id IS NULL
        AND ct.id IS NOT NULL
      `);

    const unlinkedConversations = result.recordset;
    let linkedCount = 0;

    for (const conv of unlinkedConversations) {
      await this.linkContact(conv.conversation_id, conv.contact_id_from_table);
      linkedCount++;
      console.log(`Linked conversation ${conv.conversation_id} to contact ${conv.contact_id_from_table}`);
    }

    return linkedCount;
  },

  // Get all conversation IDs for a contact (for socket rooms)
  async getConversationIdsByContactId(contactId) {
    const pool = await getSQLPool();

    const result = await pool.request()
      .input('contactId', sql.Int, contactId)
      .query(`
        SELECT id, jid, type
        FROM conversations 
        WHERE contact_id = @contactId
      `);

    return result.recordset;
  },

  // Get conversation by ID
  async getConversationById(conversationId) {
    const pool = await getSQLPool();

    const result = await pool.request()
      .input('conversationId', sql.Int, conversationId)
      .query(`
        SELECT id, jid, type, contact_id, last_message_at, unread_count
        FROM conversations 
        WHERE id = @conversationId
      `);
    return result.recordset[0] || null;
  },

  // Update contact profile picture
  // Get contacts by phone numbers (for profile picture fetching)
  async getContactsByPhoneNumbers(phoneNumbers) {
    const pool = await getSQLPool();

    if (!phoneNumbers || phoneNumbers.length === 0) {
      return [];
    }

    // Create parameter placeholders for IN clause
    const placeholders = phoneNumbers.map((_, index) => `@phone${index}`).join(',');
    
    const request = pool.request();
    
    // Add parameters
    phoneNumbers.forEach((phone, index) => {
      request.input(`phone${index}`, sql.NVarChar, phone);
    });

    const result = await request.query(`
      SELECT 
        id,
        display_name,
        phone_number,
        profile_pic_url,
        profile_pic_fetched,
        primary_jid
      FROM contacts
      WHERE phone_number IN (${placeholders})
    `);

    return result.recordset;
  },

  async getContactsNeedingProfilePics() {
    const pool = await getSQLPool();

    const result = await pool.request().query(`
      SELECT 
        id,
        display_name,
        phone_number,
        primary_jid,
        profile_pic_url,
        profile_pic_fetched
      FROM contacts
      WHERE primary_jid IS NOT NULL
        AND primary_jid LIKE '%@s.whatsapp.net'
        AND (profile_pic_url IS NULL OR profile_pic_url = '')
      ORDER BY created_at DESC
    `);

    return result.recordset;
  },

  async updateProfilePic(contactId, url) {
    const pool = await getSQLPool();

    await pool.request()
      .input('contactId', sql.Int, contactId)
      .input('url', sql.NVarChar, url)
      .query(`
        UPDATE contacts
          SET profile_pic_url = @url,
              profile_pic_fetched = 1
          WHERE id = @contactId
      `);

    logger.info(`Profile picture updated for contact ${contactId}`, { url: url ? 'yes' : 'no' });
  }
};
