import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import sql from 'mssql';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '..', '.env') });

// Required tables for LeadOps
const REQUIRED_TABLES = [
  'openai_usage_logs',
  'dealer_leads', 
  'distributor_offerings',
  'message_replies',
  'ignored_messages'
];

const checkAndCreateTables = async () => {
  try {
    console.log('🔍 Checking database tables...\n');

    // SQL Server configuration
    const sqlConfig = {
      user: process.env.SQLSERVER_USER,
      password: process.env.SQLSERVER_PASSWORD,
      server: process.env.SQLSERVER_SERVER,
      database: process.env.SQLSERVER_DATABASE,
      port: parseInt(process.env.SQLSERVER_PORT, 10),
      options: {
        encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
        enableArithAbort: process.env.SQLSERVER_ENABLE_ARITH_ABORT === 'true',
        trustServerCertificate: process.env.SQLSERVER_TRUST_SERVER_CERT === 'true'
      },
      pool: {
        max: 1,
        min: 0,
        idleTimeoutMillis: 10000
      },
      connectionTimeout: 30000,
      requestTimeout: 30000
    };

    console.log('📡 Connecting to SQL Server...');
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Connected to SQL Server\n');

    // Check existing tables
    console.log('📋 Checking existing tables...');
    const checkTablesQuery = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' 
      AND TABLE_SCHEMA = 'dbo'
    `;
    
    const result = await pool.request().query(checkTablesQuery);
    const existingTables = result.recordset.map(row => row.TABLE_NAME.toLowerCase());
    
    console.log('Existing tables:', existingTables.length > 0 ? existingTables : 'None found');
    console.log('');

    // Find missing tables
    const missingTables = REQUIRED_TABLES.filter(table => !existingTables.includes(table.toLowerCase()));
    
    if (missingTables.length === 0) {
      console.log('🎉 All required tables already exist!');
      console.log('Tables:', REQUIRED_TABLES.join(', '));
    } else {
      console.log('❌ Missing tables:', missingTables.join(', '));
      console.log('\n🔧 Creating missing tables...\n');

      // Create missing tables
      for (const tableName of missingTables) {
        try {
          await createTable(pool, tableName);
          console.log(`✅ Created table: ${tableName}`);
        } catch (error) {
          console.error(`❌ Failed to create table ${tableName}:`, error.message);
        }
      }
      
      console.log('\n🎉 Table creation completed!');
    }

    // Final verification
    console.log('\n🔍 Final verification...');
    const finalResult = await pool.request().query(checkTablesQuery);
    const finalTables = finalResult.recordset.map(row => row.TABLE_NAME.toLowerCase());
    
    console.log('Current tables in database:');
    REQUIRED_TABLES.forEach(table => {
      const status = finalTables.includes(table.toLowerCase()) ? '✅' : '❌';
      console.log(`  ${status} ${table}`);
    });

    await pool.close();
    console.log('\n🎉 Database setup completed!');

  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    if (error.originalError) {
      console.error('Original error:', error.originalError.message);
    }
    process.exit(1);
  }
};

async function createTable(pool, tableName) {
  let createQuery;
  
  switch (tableName) {
    case 'openai_usage_logs':
      createQuery = `
        CREATE TABLE openai_usage_logs (
          id INT IDENTITY(1,1) PRIMARY KEY,
          wa_message_id NVARCHAR(255) NULL,
          model NVARCHAR(100) NULL,
          input_tokens INT NULL,
          output_tokens INT NULL,
          total_tokens INT NULL,
          cost_input_usd DECIMAL(10,6) NULL,
          cost_output_usd DECIMAL(10,6) NULL,
          cost_total_usd DECIMAL(10,6) NULL,
          latency_ms INT NULL,
          raw_message NVARCHAR(MAX) NULL,
          created_at DATETIME DEFAULT GETUTCDATE()
        )
      `;
      break;
      
    case 'dealer_leads':
      createQuery = `
        CREATE TABLE dealer_leads (
          id INT IDENTITY(1,1) PRIMARY KEY,
          sender NVARCHAR(255) NULL,
          chat_id NVARCHAR(255) NULL,
          chat_type NVARCHAR(50) NULL,
          brand NVARCHAR(100) NULL,
          model NVARCHAR(100) NULL,
          variant NVARCHAR(100) NULL,
          ram INT NULL,
          storage INT NULL,
          colors NVARCHAR(MAX) NULL,
          quantity INT NULL,
          quantity_min INT NULL,
          quantity_max INT NULL,
          price DECIMAL(10,2) NULL,
          price_min DECIMAL(10,2) NULL,
          price_max DECIMAL(10,2) NULL,
          condition NVARCHAR(20) NULL,
          gst BIT NULL,
          dispatch NVARCHAR(20) NULL,
          confidence DECIMAL(3,2) NULL,
          raw_message NVARCHAR(MAX) NULL,
          created_at DATETIME DEFAULT GETUTCDATE()
        )
      `;
      break;
      
    case 'distributor_offerings':
      createQuery = `
        CREATE TABLE distributor_offerings (
          id INT IDENTITY(1,1) PRIMARY KEY,
          sender NVARCHAR(255) NULL,
          chat_id NVARCHAR(255) NULL,
          chat_type NVARCHAR(50) NULL,
          brand NVARCHAR(100) NULL,
          model NVARCHAR(100) NULL,
          variant NVARCHAR(100) NULL,
          ram INT NULL,
          storage INT NULL,
          colors NVARCHAR(MAX) NULL,
          quantity INT NULL,
          quantity_min INT NULL,
          quantity_max INT NULL,
          price DECIMAL(10,2) NULL,
          price_min DECIMAL(10,2) NULL,
          price_max DECIMAL(10,2) NULL,
          condition NVARCHAR(20) NULL,
          gst BIT NULL,
          dispatch NVARCHAR(20) NULL,
          confidence DECIMAL(3,2) NULL,
          raw_message NVARCHAR(MAX) NULL,
          created_at DATETIME DEFAULT GETUTCDATE()
        )
      `;
      break;
      
    case 'message_replies':
      createQuery = `
        CREATE TABLE message_replies (
          id INT IDENTITY(1,1) PRIMARY KEY,
          replied_by NVARCHAR(255) NULL,
          replied_by_name NVARCHAR(255) NULL,
          replied_message NVARCHAR(MAX) NULL,
          replied_at DATETIME NULL,
          quoted_message_id NVARCHAR(255) NULL,
          quoted_message_text NVARCHAR(MAX) NULL,
          chat_type NVARCHAR(50) NULL,
          source NVARCHAR(50) NULL,
          created_at DATETIME DEFAULT GETUTCDATE()
        )
      `;
      break;
      
    case 'ignored_messages':
      createQuery = `
        CREATE TABLE ignored_messages (
          id INT IDENTITY(1,1) PRIMARY KEY,
          sender NVARCHAR(255) NULL,
          chat_id NVARCHAR(255) NULL,
          chat_type NVARCHAR(50) NULL,
          confidence DECIMAL(3,2) NULL,
          raw_message NVARCHAR(MAX) NULL,
          created_at DATETIME DEFAULT GETUTCDATE()
        )
      `;
      break;
      
    default:
      throw new Error(`Unknown table: ${tableName}`);
  }
  
  await pool.request().query(createQuery);
}

checkAndCreateTables();
