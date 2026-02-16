import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import sql from 'mssql';

// Load environment variables explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '.env') });

// ---------- STEP 1: RAW ENV CHECK ----------
console.log('\n===== RAW ENV CHECK =====');
const rawEnv = {
  SQLSERVER_USER: process.env.SQLSERVER_USER,
  SQLSERVER_PASSWORD_LENGTH: process.env.SQLSERVER_PASSWORD?.length,
  SQLSERVER_SERVER: process.env.SQLSERVER_SERVER,
  SQLSERVER_DATABASE: process.env.SQLSERVER_DATABASE,
  SQLSERVER_PORT: process.env.SQLSERVER_PORT,
  SQLSERVER_ENCRYPT: process.env.SQLSERVER_ENCRYPT,
  SQLSERVER_TRUST_SERVER_CERT: process.env.SQLSERVER_TRUST_SERVER_CERT,
  SQLSERVER_ENABLE_ARITH_ABORT: process.env.SQLSERVER_ENABLE_ARITH_ABORT
};
console.log(rawEnv);

// Hard stop if anything critical is missing
const missing = Object.entries(rawEnv)
  .filter(([k, v]) => v === undefined || v === null || v === '')
  .map(([k]) => k);

if (missing.length) {
  console.error('\n❌ MISSING ENV VARS:', missing);
  process.exit(1);
}

// ---------- STEP 2: BUILD CONFIG EXPLICITLY ----------
const sqlConfig = {
  user: process.env.SQLSERVER_USER.trim(),
  password: process.env.SQLSERVER_PASSWORD,
  server: process.env.SQLSERVER_SERVER.trim(),
  database: process.env.SQLSERVER_DATABASE.trim(),
  port: Number(process.env.SQLSERVER_PORT),
  options: {
    encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQLSERVER_TRUST_SERVER_CERT === 'true',
    enableArithAbort: process.env.SQLSERVER_ENABLE_ARITH_ABORT === 'true'
  },
  pool: {
    max: 1,
    min: 0,
    idleTimeoutMillis: 10000
  },
  connectionTimeout: 10000,
  requestTimeout: 10000
};

console.log('\n===== FINAL SQL CONFIG (SANITIZED) =====');
console.log({
  ...sqlConfig,
  password: '***hidden***'
});

// ---------- STEP 3: CONNECTIVITY TEST ----------
(async () => {
  console.log('\n===== SQL CONNECTION TEST =====');
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Connected to SQL Server');

    // ---------- STEP 4: WHO AM I ----------
const whoAmI = await pool.request().query(`
  SELECT
    SUSER_SNAME() AS login_name,
    USER_NAME() AS database_user
`);
console.log('AUTH CONTEXT:', whoAmI.recordset[0]);
    console.log('\n===== AUTH CONTEXT =====');
    console.log(whoAmI.recordset[0]);

    // ---------- STEP 5: SIMPLE QUERY ----------
    const version = await pool.request().query(`
      SELECT @@VERSION AS version, GETDATE() AS now
    `);
    console.log('\n===== SERVER INFO =====');
    console.log({
      version: version.recordset[0].version.split('\n')[0],
      now: version.recordset[0].now
    });

    // ---------- STEP 6: DB PERMISSION TEST ----------
    const permTest = await pool.request().query(`
      SELECT 
        HAS_DBACCESS(DB_NAME()) AS has_db_access
    `);
    console.log('\n===== DB ACCESS CHECK =====');
    console.log(permTest.recordset[0]);

    await pool.close();
    console.log('\n✅ ALL TESTS PASSED');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ SQL TEST FAILED');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);

    if (err.originalError) {
      console.error('\n--- ORIGINAL ERROR ---');
      console.error(err.originalError.message);
    }

    process.exit(1);
  }
})();