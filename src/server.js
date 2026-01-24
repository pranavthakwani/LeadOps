import { initSQLServer } from './config/sqlserver.js';
import { initOpenAI } from './config/openai.js';
import { initWhatsAppConfig } from './config/whatsapp.js';
import { getEnv } from './config/env.js';
import { createApp } from './app.js';
import { createLogger } from './utils/logger.js';
import { whatsappService } from './services/whatsapp.js';

const logger = createLogger('Server');

const start = () => {
  try {
    const env = getEnv();

    logger.info('Initializing configurations');
    initSQLServer();
    initOpenAI();
    initWhatsAppConfig();
    
    // Initialize WhatsApp client
    logger.info('Initializing WhatsApp client...');
    // The whatsappService is automatically initialized when imported
    // It will show QR code in the console when ready

    const app = createApp();
    const port = env.webhook.port;

    app.listen(port, '0.0.0.0', () => {
      logger.info(`Server started on port ${port}`);
      logger.info('Available endpoints:');
      logger.info(`  GET  /health`);
      logger.info(`  POST /whatsapp-ai`);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

start();
