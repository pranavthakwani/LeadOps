import { initSQLServer, getSQLPool } from '../src/config/sqlserver.js';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('🚀 Starting profile picture migration...');
    
    // Initialize SQL Server
    await initSQLServer();
    console.log('✅ SQL Server initialized');
    
    // Read migration SQL file
    const migrationPath = path.join(process.cwd(), 'migrations', 'add_profile_pic_columns_safe.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded');
    
    // Execute migration
    const pool = await getSQLPool();
    
    // Split SQL into individual statements
    const statements = migrationSQL
      .split('GO')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    for (const statement of statements) {
      console.log(`🔄 Executing: ${statement.substring(0, 50)}...`);
      await pool.request().query(statement);
    }
    
    console.log('✅ Profile picture migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('🔍 Full error:', error);
    process.exit(1);
  }
}

runMigration();
