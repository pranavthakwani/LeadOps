const validateEnv = () => {
  const required = [
    'SQLSERVER_USER',
    'SQLSERVER_PASSWORD',
    'SQLSERVER_SERVER',
    'SQLSERVER_DATABASE',
    'SQLSERVER_PORT',
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'OPENAI_MAX_TOKENS',
    'WHATSAPP_SESSION_PATH',
    'WEBHOOK_PORT',
    'LOG_LEVEL'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
};

export const getEnv = () => {
  validateEnv();

  return {
    sqlserver: {
      user: process.env.SQLSERVER_USER,
      password: process.env.SQLSERVER_PASSWORD,
      server: process.env.SQLSERVER_SERVER,
      database: process.env.SQLSERVER_DATABASE,
      port: parseInt(process.env.SQLSERVER_PORT, 10),
      options: {
        encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
        enableArithAbort: process.env.SQLSERVER_ENABLE_ARITH_ABORT === 'true',
        trustServerCertificate: process.env.SQLSERVER_TRUST_SERVER_CERT === 'true',
        requestTimeout: parseInt(process.env.SQLSERVER_REQUEST_TIMEOUT || '600000', 10)
      },
      pool: {
        max: parseInt(process.env.SQLSERVER_POOL_MAX || '10', 10),
        min: parseInt(process.env.SQLSERVER_POOL_MIN || '0', 10),
        idleTimeoutMillis: parseInt(process.env.SQLSERVER_POOL_IDLE_TIMEOUT || '30000', 10)
      }
    },
    // Keep Supabase config for potential future use or migration
    supabase: {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL,
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS, 10)
    },
    whatsapp: {
      disabled: process.env.WHATSAPP_DISABLED === 'true',
      sessionPath: process.env.WHATSAPP_SESSION_PATH,
      targetBusinessName: process.env.TARGET_BUSINESS_NAME || null,
      targetGroupName: process.env.WHATSAPP_TARGET_GROUP_NAME || null,
      targetBroadcastListName: process.env.WHATSAPP_TARGET_BROADCAST_LIST_NAME || null
    },
    webhook: {
      port: parseInt(process.env.WEBHOOK_PORT, 10)
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info'
    }
  };
};
