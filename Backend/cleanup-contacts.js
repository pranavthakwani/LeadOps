const { getSQLPool } = require('../src/config/sqlserver.js');
const sql = require('mssql');

async function cleanupUnknownContacts() {
  try {
    console.log('Starting cleanup of Unknown contacts...');
    
    const pool = getSQLPool();
    
    const result = await pool.request()
      .query(`
        UPDATE contacts
        SET display_name = phone_number
        WHERE display_name = 'Unknown'
      `);

    console.log(`✅ Updated ${result.rowsAffected[0]} Unknown contacts to show phone numbers`);
    
    // Also update any auto-generated contacts to have is_auto_generated = 1 if they don't have it set
    const autoGenResult = await pool.request()
      .query(`
        UPDATE contacts
        SET is_auto_generated = 1
        WHERE is_auto_generated IS NULL 
        AND display_name != phone_number
        AND id NOT IN (
          SELECT DISTINCT c.id
          FROM contacts c
          INNER JOIN conversations conv ON c.id = conv.contact_id
        )
      `);

    console.log(`✅ Updated ${autoGenResult.rowsAffected[0]} contacts to is_auto_generated = 1`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

cleanupUnknownContacts();
