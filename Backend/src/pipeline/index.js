import { normalizeText } from './01-normalize-text.js';
import { openaiUnderstanding } from './02-openai-understanding.js';
import { parseAndValidateJSON } from './03-parse-validate-json.js';
import { zodSchemaValidation } from './04-zod-schema-validation.js';
import { brandVariantNormalization } from './05-brand-variant-normalization.js';
import { routeByMessageType } from './06-route-by-message-type.js';
import { insertToSQLServerDB } from './07-insert-to-db-sqlserver.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Pipeline');

export const processPipeline = async (webhookPayload) => {
  try {
    logger.info('Pipeline started', { sender: webhookPayload.body?.sender });

    let payload = webhookPayload;

    payload = normalizeText(payload);
    logger.debug('Normalized text');

    payload = await openaiUnderstanding(payload);
    logger.debug('OpenAI understanding complete');

    let parsedItems = parseAndValidateJSON(payload);
    logger.debug('JSON parsed', { count: parsedItems.length });

    let validatedItems = zodSchemaValidation(parsedItems);
    logger.debug('Schema validation complete', { count: validatedItems.length });

    let normalizedItems = brandVariantNormalization(validatedItems);
    logger.debug('Brand normalization complete', { count: normalizedItems.length });

    let routedItems = routeByMessageType(normalizedItems);
    logger.debug('Message routing complete', { count: routedItems.length });

    let insertedItems = await insertToSQLServerDB(routedItems);
    logger.debug('Database insert complete', { count: insertedItems.length });

    logger.info('Pipeline completed', { sender: webhookPayload.body?.sender });

    return insertedItems;

  } catch (error) {
    logger.error('Pipeline fatal error', error);
    throw error;
  }
};
