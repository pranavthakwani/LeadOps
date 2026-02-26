import { safeJSONParse } from '../utils/json-parser.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Parse and Validate JSON');

const parseQuantityRange = (text) => {
  if (!text || typeof text !== 'string') {
    return { quantity: null, quantity_min: null, quantity_max: null };
  }

  const quantityPatterns = [
    /(\d+)\s*[-–—]\s*(\d+)\s*(?:pcs|pieces|units)/i,
    /(\d+)\s*(?:pcs|pieces|units)\s*[-–—]\s*(\d+)\s*(?:pcs|pieces|units)?/i,
  ];

  for (const pattern of quantityPatterns) {
    const match = text.match(pattern);
    if (match) {
      const val1 = parseInt(match[1], 10);
      const val2 = parseInt(match[2], 10);
      if (!isNaN(val1) && !isNaN(val2)) {
        return {
          quantity: null,
          quantity_min: Math.min(val1, val2),
          quantity_max: Math.max(val1, val2)
        };
      }
    }
  }

  const singleQuantityPattern = /(\d+)\s*(?:pcs|pieces|units)/i;
  const singleMatch = text.match(singleQuantityPattern);
  if (singleMatch) {
    const val = parseInt(singleMatch[1], 10);
    if (!isNaN(val)) {
      return {
        quantity: val,
        quantity_min: val,
        quantity_max: val
      };
    }
  }

  return { quantity: null, quantity_min: null, quantity_max: null };
};

const parsePriceRange = (text) => {
  if (!text || typeof text !== 'string') {
    return { price: null, price_min: null, price_max: null };
  }

  const pricePatterns = [
    /(?:₹|rs\.?|inr)?\s*(\d+)\s*[-–—]\s*(\d+)(?!\s*(?:pcs|pieces|units))/i,
    /(\d+)\s*(?:k|thousand)\s*[-–—]\s*(\d+)\s*(?:k|thousand)(?!\s*(?:pcs|pieces|units))/i,
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      let val1 = parseInt(match[1], 10);
      let val2 = parseInt(match[2], 10);

      if (text.toLowerCase().includes('k') || text.toLowerCase().includes('thousand')) {
        val1 *= 1000;
        val2 *= 1000;
      }

      if (!isNaN(val1) && !isNaN(val2)) {
        return {
          price: null,
          price_min: Math.min(val1, val2),
          price_max: Math.max(val1, val2)
        };
      }
    }
  }

  const singlePricePattern = /(?:₹|rs\.?|inr)?\s*(\d+)(?:\s*(?:k|thousand))?(?!\s*(?:pcs|pieces|units))/i;
  const singleMatch = text.match(singlePricePattern);
  if (singleMatch) {
    let val = parseInt(singleMatch[1], 10);

    if (text.toLowerCase().includes('k') || text.toLowerCase().includes('thousand')) {
      val *= 1000;
    }

    if (!isNaN(val) && val > 100) {
      return {
        price: val,
        price_min: val,
        price_max: val
      };
    }
  }

  return { price: null, price_min: null, price_max: null };
};

export const parseAndValidateJSON = (payload) => {
  try {
    const rawText = payload.output?.[0]?.content?.[0]?.text;

    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Missing OpenAI JSON text from output[0].content[0].text');
    }

    const parsed = safeJSONParse(rawText);

    if (!parsed) {
      throw new Error('Invalid JSON returned by OpenAI');
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Parsed value is not an object');
    }

    const isBusiness =
      typeof parsed.is_business_message === 'boolean'
        ? parsed.is_business_message
        : Array.isArray(parsed.items) && parsed.items.length > 0;

    const base = {
      is_business_message: isBusiness,
      message_type: parsed.message_type ?? 'noise',
      actor_type: parsed.actor_type ?? 'unknown',
      confidence:
        parsed.confidence !== undefined &&
        !Number.isNaN(Number(parsed.confidence))
          ? Number(parsed.confidence)
          : isBusiness ? 0.6 : 0,
      source: parsed.source ?? {
        sender: 'unknown',
        chat_id: 'unknown',
        chat_type: 'unknown',
        raw_message: ''
      }
    };

    const results = [];

    if (Array.isArray(parsed.items) && parsed.items.length > 0) {
      for (const sku of parsed.items) {
        const rawMessage = parsed.source?.raw_message || '';

        let quantityData;
        if (sku?.quantity !== undefined && sku?.quantity !== null) {
          const val = Number(sku.quantity);
          quantityData = { quantity: val, quantity_min: val, quantity_max: val };
        } else if (sku?.quantity_min !== undefined && sku?.quantity_max !== undefined) {
          quantityData = {
            quantity: null,
            quantity_min: Number(sku.quantity_min),
            quantity_max: Number(sku.quantity_max)
          };
        } else {
          quantityData = parseQuantityRange(rawMessage);
        }

        let priceData;
        if (sku?.price !== undefined && sku?.price !== null) {
          const val = Number(sku.price);
          priceData = { price: val, price_min: val, price_max: val };
        } else if (sku?.price_min !== undefined && sku?.price_max !== undefined) {
          priceData = {
            price: null,
            price_min: Number(sku.price_min),
            price_max: Number(sku.price_max)
          };
        } else {
          priceData = parsePriceRange(rawMessage);
        }

        results.push({
          ...base,
          brand: sku?.brand ?? parsed.brand ?? null,
          model: sku?.model ?? null,
          variant: sku?.variant ?? null,
          ram: sku?.ram !== undefined && sku?.ram !== null ? Number(sku.ram) : null,
          storage: sku?.storage !== undefined && sku?.storage !== null ? Number(sku.storage) : null,
          colors: typeof sku?.colors === 'object' && sku.colors !== null ? sku.colors : {},
          price: priceData.price,
          price_min: priceData.price_min,
          price_max: priceData.price_max,
          quantity: quantityData.quantity,
          quantity_min: quantityData.quantity_min,
          quantity_max: quantityData.quantity_max,
          condition: sku?.condition ?? parsed.condition ?? null,
          gst: typeof sku?.gst === 'boolean' ? sku.gst : typeof parsed.gst === 'boolean' ? parsed.gst : null,
          dispatch: sku?.dispatch ?? parsed.dispatch ?? null,
          // Preserve wa_message_id from payload
          wa_message_id: payload.wa_message_id || null
        });
      }
    } else {
      const rawMessage = parsed.source?.raw_message || '';
      const quantityData = parseQuantityRange(rawMessage);
      const priceData = parsePriceRange(rawMessage);

      results.push({
        ...base,
        brand: parsed.brand ?? null,
        model: null,
        variant: null,
        ram: null,
        storage: null,
        colors: {},
        price: priceData.price,
        price_min: priceData.price_min,
        price_max: priceData.price_max,
        quantity: quantityData.quantity,
        quantity_min: quantityData.quantity_min,
        quantity_max: quantityData.quantity_max,
        condition: parsed.condition ?? null,
        gst: typeof parsed.gst === 'boolean' ? parsed.gst : null,
        dispatch: parsed.dispatch ?? null,
        // Preserve wa_message_id from payload
        wa_message_id: payload.wa_message_id || null
      });
    }

    return results;

  } catch (error) {
    logger.error('Parse error', error);

    return [
      {
        is_business_message: false,
        message_type: 'noise',
        actor_type: payload.body?.actor_type || 'unknown',
        brand: null,
        model: null,
        variant: null,
        ram: null,
        storage: null,
        colors: {},
        price: null,
        price_min: null,
        price_max: null,
        quantity: null,
        quantity_min: null,
        quantity_max: null,
        condition: null,
        gst: null,
        dispatch: null,
        confidence: 0,
        // Preserve wa_message_id from payload even in error case
        wa_message_id: payload.wa_message_id || null,
        source: {
          sender: payload.body?.sender || 'unknown',
          chat_id: payload.body?.chat_id || 'unknown',
          chat_type: payload.body?.chat_type || 'unknown',
          raw_message: payload.body?.raw_text || payload.body?.normalized_text || ''
        },
        error: error instanceof Error ? error.message : String(error)
      }
    ];
  }
};
