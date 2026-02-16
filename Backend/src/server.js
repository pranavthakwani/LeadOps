import { initSQLServer } from './config/sqlserver.js';
import { initOpenAI } from './config/openai.js';
import { initWhatsAppConfig } from './config/whatsapp.js';
import { getEnv } from './config/env.js';
import { createApp } from './app.js';
import { createLogger } from './utils/logger.js';
import { baileysService } from './services/baileys.js';

const logger = createLogger('Server');

const start = async () => {
  try {
    const env = getEnv();

    logger.info('Initializing configurations');
    initSQLServer();
    initOpenAI();
    initWhatsAppConfig();
    
    // Initialize WhatsApp client only if enabled
    if (!env.whatsapp.disabled) {
      logger.info('Initializing WhatsApp client...');
      await baileysService.initialize();
    } else {
      logger.info('WhatsApp integration is disabled - skipping client initialization');
    }

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

// Handle process shutdown gracefully
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  try {
    await baileysService.shutdown();
    logger.info('WhatsApp service shut down successfully');
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  try {
    await baileysService.shutdown();
    logger.info('WhatsApp service shut down successfully');
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
  }
  process.exit(0);
});

start();
