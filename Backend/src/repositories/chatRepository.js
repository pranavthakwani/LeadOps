import sql from 'mssql';
import { getSQLPool } from '../config/sqlserver.js';

export const chatRepository = {

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
      return; // Skip insert if message already exists
    }

    await pool.request()
      .input('jid', sql.NVarChar, data.jid)
      .input('waMessageId', sql.NVarChar, data.waMessageId)
      .input('fromMe', sql.Bit, data.fromMe)
      .input('text', sql.NVarChar(sql.MAX), data.text)
      .input('timestamp', sql.BigInt, data.timestamp)
      .query(`
        INSERT INTO chat_messages
        (jid, wa_message_id, from_me, message_text, message_timestamp)
        VALUES (@jid, @waMessageId, @fromMe, @text, @timestamp)
      `);
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
  }

};
