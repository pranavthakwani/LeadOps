import { createLogger } from '../utils/logger.js';

const logger = createLogger('Zod Schema Validation');

export const zodSchemaValidation = (items) => {
  const results = [];

  for (const item of items) {
    const payload = item;
    const errors = [];

    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      errors.push('Payload must be a non-null object');
    }

    if (typeof payload.is_business_message !== 'boolean') {
      errors.push('is_business_message must be boolean');
    }

    const validMessageTypes = ['offering', 'lead', 'noise'];
    if (!validMessageTypes.includes(payload.message_type)) {
      errors.push(`message_type must be one of: ${validMessageTypes.join(', ')}`);
    }

    const validActorTypes = ['distributor', 'dealer', 'unknown'];
    if (!validActorTypes.includes(payload.actor_type)) {
      errors.push(`actor_type must be one of: ${validActorTypes.join(', ')}`);
    }

    if (typeof payload.confidence !== 'number' || payload.confidence < 0 || payload.confidence > 1) {
      errors.push('confidence must be a number between 0 and 1');
    }

    if (payload.message_type === 'offering' || payload.message_type === 'lead') {
      if (!payload.brand && payload.brand !== null) {
        errors.push('brand must exist for offering/lead messages');
      }
      if (!payload.model && payload.model !== null) {
        errors.push('model must exist for offering/lead messages');
      }
      if (!payload.variant && payload.variant !== null) {
        errors.push('variant must exist for offering/lead messages');
      }
    }

    if (payload.brand !== null && typeof payload.brand !== 'string') {
      errors.push('brand must be string or null');
    }
    if (payload.model !== null && typeof payload.model !== 'string') {
      errors.push('model must be string or null');
    }
    if (payload.variant !== null && typeof payload.variant !== 'string') {
      errors.push('variant must be string or null');
    }

    if (payload.ram !== null && typeof payload.ram !== 'number' && typeof payload.ram !== 'string') {
      errors.push('ram must be number, string, or null');
    } else if (typeof payload.ram === 'string') {
      payload.ram = parseInt(payload.ram, 10);
      if (isNaN(payload.ram)) {
        errors.push('ram string must be convertible to number');
        payload.ram = null;
      }
    }

    if (payload.storage !== null && typeof payload.storage !== 'number' && typeof payload.storage !== 'string') {
      errors.push('storage must be number, string, or null');
    } else if (typeof payload.storage === 'string') {
      payload.storage = parseInt(payload.storage, 10);
      if (isNaN(payload.storage)) {
        errors.push('storage string must be convertible to number');
        payload.storage = null;
      }
    }

    if (typeof payload.colors !== 'object' || payload.colors === null || Array.isArray(payload.colors)) {
      errors.push('colors must be an object');
    }
    if (payload.price !== null && typeof payload.price !== 'number') {
      errors.push('price must be number or null');
    }
    if (payload.quantity !== null && typeof payload.quantity !== 'number') {
      errors.push('quantity must be number or null');
    }

    const requiredKeys = ['is_business_message', 'message_type', 'actor_type', 'confidence', 'source'];
    for (const key of requiredKeys) {
      if (!(key in payload)) {
        errors.push(`Missing required key: ${key}`);
      }
    }

    if (errors.length > 0) {
      logger.warn('Validation failed, converting to noise', { errors });

      results.push({
        is_business_message: false,
        message_type: 'noise',
        actor_type: payload.actor_type || 'unknown',
        confidence: 0,
        brand: null,
        model: null,
        variant: null,
        ram: null,
        storage: null,
        colors: {},
        price: null,
        quantity: null,
        condition: null,
        gst: null,
        dispatch: null,
        source: payload.source || {
          sender: 'unknown',
          chat_id: 'unknown',
          chat_type: 'unknown',
          raw_message: ''
        },
        error: `Validation failed: ${errors.join('; ')}`
      });
    } else {
      results.push(payload);
    }
  }

  return results;
};
