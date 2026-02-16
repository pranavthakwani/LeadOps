import sql from 'mssql';
import { getEnv } from './env.js';

let pool = null;

export const initSQLServer = async () => {
  if (pool) {
    return pool;
  }

  const env = getEnv();

  const config = {
    user: env.sqlserver.user,
    password: env.sqlserver.password,
    server: env.sqlserver.server,
    database: env.sqlserver.database,
    port: env.sqlserver.port,
    options: env.sqlserver.options,
    pool: env.sqlserver.pool,
    connectionTimeout: 15000,
    requestTimeout: 15000
  };

  pool = await sql.connect(config); // 🔥 CONNECT ONCE
  return pool;
};

export const getSQLPool = () => {
  if (!pool) {
    throw new Error('SQL Server not initialized. Call initSQLServer() on startup.');
  }
  return pool;
};