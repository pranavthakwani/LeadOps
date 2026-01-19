const validateEnv = () => {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
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
