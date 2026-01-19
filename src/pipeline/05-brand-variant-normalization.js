import { CANONICAL_BRANDS, BRAND_SHORTHANDS, VALID_RAM, VALID_STORAGE } from '../constants/brands.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Brand & Variant Normalization');

const levenshteinDistance = (a, b) => {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

const normalizeBrand = (brand) => {
  if (!brand || typeof brand !== 'string') {
    return null;
  }

  let normalized = brand.toLowerCase().trim();
  normalized = normalized.replace(/[^a-z0-9\s]/g, '');

  if (BRAND_SHORTHANDS[normalized]) {
    return BRAND_SHORTHANDS[normalized];
  }

  let bestMatch = null;
  let bestDistance = Infinity;

  for (const canonical of CANONICAL_BRANDS) {
    const distance = levenshteinDistance(normalized, canonical.toLowerCase());
    if (distance <= 2 && distance < bestDistance) {
      bestMatch = canonical;
      bestDistance = distance;
    }
  }

  if (bestMatch && bestDistance <= 2) {
    return bestMatch;
  }

  return brand;
};

const extractRamStorage = (variant) => {
  if (!variant || typeof variant !== 'string') {
    return { ram: null, storage: null, normalizedVariant: variant };
  }

  const pattern = /(\d+)\s*\/\s*(\d+)/;
  const match = variant.match(pattern);

  if (match) {
    const ram = parseInt(match[1], 10);
    const storage = parseInt(match[2], 10);

    if (ram <= 24 && VALID_STORAGE.includes(storage)) {
      return {
        ram: ram,
        storage: storage,
        normalizedVariant: `${ram}/${storage}`
      };
    }
  }

  return { ram: null, storage: null, normalizedVariant: variant };
};

const extractQuantityRange = (text) => {
  if (!text || typeof text !== 'string') {
    return { quantity: null, quantity_min: null, quantity_max: null };
  }

  const patterns = [
    /(\d+)\s*[-–—]\s*(\d+)\s*(?:pcs|pieces|units)?/i,
    /(\d+)\s+to\s+(\d+)\s*(?:pcs|pieces|units)?/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const min = parseInt(match[1], 10);
      const max = parseInt(match[2], 10);

      if (!isNaN(min) && !isNaN(max) && min < max) {
        return {
          quantity: null,
          quantity_min: min,
          quantity_max: max
        };
      }
    }
  }

  return { quantity: null, quantity_min: null, quantity_max: null };
};

const extractPriceRange = (text) => {
  if (!text || typeof text !== 'string') {
    return { price: null, price_min: null, price_max: null };
  }

  const patterns = [
    /(\d+)\s*[-–—]\s*(\d+)/,
    /(\d+)\s+to\s+(\d+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const min = parseInt(match[1], 10);
      const max = parseInt(match[2], 10);

      if (!isNaN(min) && !isNaN(max) && min < max) {
        return {
          price: null,
          price_min: min,
          price_max: max
        };
      }
    }
  }

  return { price: null, price_min: null, price_max: null };
};

const toNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

export const brandVariantNormalization = (items) => {
  const results = [];

  for (const item of items) {
    try {
      const payload = item;

      const brand = payload.brand;
      const model = payload.model;
      const variant = payload.variant;
      const existingRam = toNumber(payload.ram);
      const existingStorage = toNumber(payload.storage);
      const existingQuantity = toNumber(payload.quantity);
      const existingPrice = toNumber(payload.price);
      const existingQuantityMin = toNumber(payload.quantity_min);
      const existingQuantityMax = toNumber(payload.quantity_max);
      const existingPriceMin = toNumber(payload.price_min);
      const existingPriceMax = toNumber(payload.price_max);
      const rawMessage = payload.source?.raw_message || '';

      const normalizedBrand = normalizeBrand(brand);

      const { ram, storage, normalizedVariant } = extractRamStorage(variant);

      let finalQuantity = existingQuantity;
      let finalQuantityMin = existingQuantityMin;
      let finalQuantityMax = existingQuantityMax;

      if (existingQuantityMin === null && existingQuantityMax === null) {
        const quantityRange = extractQuantityRange(variant || rawMessage);

        if (quantityRange.quantity_min !== null && quantityRange.quantity_max !== null) {
          finalQuantity = null;
          finalQuantityMin = quantityRange.quantity_min;
          finalQuantityMax = quantityRange.quantity_max;
        } else if (existingQuantity !== null) {
          finalQuantity = existingQuantity;
          finalQuantityMin = existingQuantity;
          finalQuantityMax = existingQuantity;
        }
      }

      let finalPrice = existingPrice;
      let finalPriceMin = existingPriceMin;
      let finalPriceMax = existingPriceMax;

      if (existingPriceMin === null && existingPriceMax === null) {
        const priceRange = extractPriceRange(variant || rawMessage);

        if (priceRange.price_min !== null && priceRange.price_max !== null) {
          finalPrice = null;
          finalPriceMin = priceRange.price_min;
          finalPriceMax = priceRange.price_max;
        } else if (existingPrice !== null) {
          finalPrice = existingPrice;
          finalPriceMin = existingPrice;
          finalPriceMax = existingPrice;
        }
      }

      results.push({
        ...payload,
        brand: normalizedBrand,
        model: model,
        variant: normalizedVariant,
        ram: ram !== null ? ram : existingRam,
        storage: storage !== null ? storage : existingStorage,
        quantity: finalQuantity,
        quantity_min: finalQuantityMin,
        quantity_max: finalQuantityMax,
        price: finalPrice,
        price_min: finalPriceMin,
        price_max: finalPriceMax
      });

    } catch (error) {
      logger.error('Normalization error', error);
      results.push(item);
    }
  }

  return results;
};
