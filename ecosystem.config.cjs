module.exports = {
  apps: [
    {
      name: "JJE LeadOps Automation",
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        // Load .env file for production
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        OPENAI_MODEL: process.env.OPENAI_MODEL,
        OPENAI_MAX_TOKENS: process.env.OPENAI_MAX_TOKENS,
        WHATSAPP_SESSION_PATH: process.env.WHATSAPP_SESSION_PATH,
        WEBHOOK_PORT: process.env.WEBHOOK_PORT,
        LOG_LEVEL: process.env.LOG_LEVEL
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true
    }
  ]
};
