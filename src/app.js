import express from 'express';
import { processPipeline } from './pipeline/index.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('Express App');

export const createApp = () => {
  const app = express();

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  app.post('/whatsapp-ai', async (req, res) => {
    try {
      logger.info('Webhook received', { sender: req.body?.sender });

      const payload = {
        body: req.body,
        normalized_text: req.body?.normalized_text,
        raw_text: req.body?.raw_text
      };

      const result = await processPipeline(payload);

      res.json({
        success: true,
        message: 'Message processed',
        itemsProcessed: result.length
      });

    } catch (error) {
      logger.error('Webhook error', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  app.use((err, req, res, next) => {
    logger.error('Unhandled error', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  });

  return app;
};
