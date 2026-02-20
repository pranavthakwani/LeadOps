import sql from 'mssql';
import { getSQLPool } from '../config/sqlserver.js';

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

      return inserted.recordset[0].id;

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
      return null; // Return null for duplicate messages
    }

    // 1️⃣ Get or create conversation
    const conversationId = await this.getOrCreateConversation(data.jid);

    // 2️⃣ Insert message WITH conversation_id
    await pool.request()
      .input('jid', sql.NVarChar, data.jid)
      .input('conversationId', sql.Int, conversationId)
      .input('waMessageId', sql.NVarChar, data.waMessageId)
      .input('fromMe', sql.Bit, data.fromMe)
      .input('text', sql.NVarChar(sql.MAX), data.text)
      .input('timestamp', sql.BigInt, data.timestamp)
      .query(`
        INSERT INTO chat_messages (
          jid,
          conversation_id,
          wa_message_id,
          from_me,
          message_text,
          message_timestamp,
          created_at
        )
        VALUES (
          @jid,
          @conversationId,
          @waMessageId,
          @fromMe,
          @text,
          @timestamp,
          GETUTCDATE()
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
        SELECT *
        FROM chat_messages
        WHERE conversation_id = @conversationId
        ORDER BY message_timestamp ASC, id ASC
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
        SELECT id 
        FROM contacts 
        WHERE phone_number = @phone
      `);

    if (existing.recordset.length > 0) {
      console.log('Found existing contact:', existing.recordset[0].id);
      return existing.recordset[0].id;
    }

    const inserted = await pool.request()
      .input('phone', sql.NVarChar, normalizedPhone)
      .input('name', sql.NVarChar, name || 'Unknown')
      .query(`
        INSERT INTO contacts (display_name, phone_number, is_auto_generated)
        OUTPUT INSERTED.id
        VALUES (@name, @phone, 0)
      `);

    console.log('Created new contact:', inserted.recordset[0].id);
    return inserted.recordset[0].id;
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
            ct.phone_number
        FROM conversations c
        LEFT JOIN contacts ct 
            ON c.contact_id = ct.id
        ORDER BY c.last_message_at DESC
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

    const result = await pool.request()
      .input('displayName', sql.NVarChar, displayName)
      .input('phoneNumber', sql.NVarChar, phoneNumber)
      .query(`
        INSERT INTO contacts (display_name, phone_number)
        VALUES (@displayName, @phoneNumber);
        
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
        SELECT id, display_name, phone_number
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
  }

};
