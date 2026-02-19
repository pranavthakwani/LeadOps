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

    // 3️⃣ Update conversation metadata
    await pool.request()
      .input('conversationId', sql.Int, conversationId)
      .input('timestamp', sql.BigInt, data.timestamp)
      .query(`
        UPDATE conversations
        SET last_message_at = @timestamp
        WHERE id = @conversationId
      `);

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
  }

};
