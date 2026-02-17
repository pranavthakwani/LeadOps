import { getSQLPool } from './src/config/sqlserver.js';
import { initSQLServer } from './src/config/sqlserver.js';

async function checkChatMessages() {
  try {
    // Initialize SQL Server connection
    console.log('🔌 Initializing SQL Server connection...');
    initSQLServer();
    
    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const pool = await getSQLPool();
    
    // Check if table exists and get count
    const countResult = await pool.request()
      .query(`
        SELECT COUNT(*) as total_messages, 
               COUNT(DISTINCT jid) as unique_chats
        FROM chat_messages
      `);
    
    console.log('📊 Chat Messages Summary:');
    console.log(`Total Messages: ${countResult.recordset[0].total_messages}`);
    console.log(`Unique Chats: ${countResult.recordset[0].unique_chats}`);
    
    // Get recent messages
    const recentResult = await pool.request()
      .query(`
        SELECT TOP 5 
          id, jid, wa_message_id, from_me, 
          message_text, message_timestamp, 
          created_at, status
        FROM chat_messages 
        ORDER BY created_at DESC
      `);
    
    if (recentResult.recordset.length > 0) {
      console.log('\n📝 Recent Messages:');
      recentResult.recordset.forEach((msg, index) => {
        console.log(`${index + 1}. ID: ${msg.id}`);
        console.log(`   JID: ${msg.jid}`);
        console.log(`   From Me: ${msg.from_me ? 'Yes' : 'No'}`);
        console.log(`   Message: ${msg.message_text?.substring(0, 50) || 'N/A'}...`);
        console.log(`   Timestamp: ${new Date(msg.message_timestamp).toLocaleString()}`);
        console.log(`   Created: ${new Date(msg.created_at).toLocaleString()}`);
        console.log('---');
      });
    } else {
      console.log('\n❌ No messages found in chat_messages table');
    }
    
    // Check table structure
    const structureResult = await pool.request()
      .query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'chat_messages'
        ORDER BY ORDINAL_POSITION
      `);
    
    console.log('\n🏗️ Table Structure:');
    structureResult.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking chat messages:', error.message);
  } finally {
    process.exit(0);
  }
}

checkChatMessages();
