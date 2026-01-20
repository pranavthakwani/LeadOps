import { createLogger } from '../utils/logger.js';

const logger = createLogger('BusinessFilter');

// Step 1: Hard Safe Filter - Only drop clearly impossible messages
function isObviouslyNonBusiness(text) {
  if (!text) return true;

  const t = text.trim().toLowerCase();

  // Ultra-obvious casual replies (hard drop)
  const CASUAL_ONLY_REGEX = /^(ok|okay|yes|y|no|nah|done|thanks|thx|👍|👌|🙏|call me|seen)$/i;
  
  if (t.length < 6 && CASUAL_ONLY_REGEX.test(t)) {
    return true;
  }

  if (t.length <= 2) return true;
  if (/^[\p{Emoji}\s]+$/u.test(t)) return true;

  return false;
}

// Step 2: High-Recall Business Parser - Signal Accumulator

// Trade Intent Signals (VERY IMPORTANT)
const TRADE_INTENT = [
  'wtb','wts','sale','sell','buy','available','stock','left',
  'dispatch','ready','fresh','offer','deal','quote','rates',
  'models','eol','price','rates','cost','rate','quotation','enquiry',
  'availability','left only','best price','can give','want to sale','for sale'
];

// Brand / OEM Signals
const BRANDS = [
  'iphone','apple','ipad','macbook','imac',
  'samsung','oppo','vivo','realme','oneplus',
  'iqoo','redmi','xiaomi','motorola','moto',
  'acer','lenovo','nokia','asus','huawei',
  'poco','infinix','tecno','itel','lava','micromax'
];

// Product Category Signals (fixes iPad/MacBook/Buds messages)
const PRODUCT_CATEGORY = [
  'iphone','ipad','macbook','imac',
  'tab','tablet','buds','earbuds',
  'airpods','watch'
];

// Model / Variant Signals (VERY LOOSE - allow false positives)
const MODEL_PATTERN = /\b[a-z]?\d{1,3}[a-z]?\b/i; // 13, A13, Z10x, F27

// RAM / ROM / Variant
const MEMORY_PATTERN = /\b\d{1,2}\s?[\/:-]\s?\d{2,3}\b/; // 8/128

// Quantity Signals
const QTY_PATTERN = /\b\d+\s?(pcs|pc|pieces|qty|left|available)\b/i;
const QTY_RANGE_PATTERN = /\b\d+\s?[-–to]+\s?\d+\b/i; // 40-60, 80 to 100

// Price Signals
const PRICE_PATTERN = /(₹|rs\.?|@)\s?\d{3,6}/i;
const BARE_PRICE_PATTERN = /\b\d{4,6}\b/; // 11260, 18700

// Condition / Logistics Signals
const CONDITION = [
  'fresh','seal','sealed','gst','nongst','bill',
  'today','office','ready','online','dispatch','delivery',
  'warranty','replacement','defective','refurbished'
];

// Wholesale Slang (low score, additive)
const WHOLESALE_SLANG = [
  'mc','act','seal pack','master carton',
  'hai','lelo','office','godown'
];

// Multi-line / List Structure Signal (VERY IMPORTANT)
function looksLikeStockList(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return false;

  let hits = 0;
  for (const line of lines) {
    if (
      MODEL_PATTERN.test(line) ||
      MEMORY_PATTERN.test(line) ||
      PRICE_PATTERN.test(line) ||
      BARE_PRICE_PATTERN.test(line)
    ) {
      hits++;
    }
  }
  return hits >= 2;
}

// Step 3: Confidence Accumulator (designed to never miss)
export function isBusinessMessage(text) {
  try {
    if (isObviouslyNonBusiness(text)) {
      logger.debug('Filtered out obviously non-business message', { text: text.substring(0, 50) });
      return false;
    }

    const t = text.toLowerCase();
    let score = 0;
    const signals = [];

    // Trade intent = STRONG
    if (TRADE_INTENT.some(k => t.includes(k))) {
      score += 4;
      signals.push('trade-intent');
    }

    // Brand presence = STRONG
    if (BRANDS.some(b => t.includes(b))) {
      score += 4;
      signals.push('brand');
    }

    // Product category = STRONG (fixes iPad/MacBook/Buds messages)
    if (PRODUCT_CATEGORY.some(p => t.includes(p))) {
      score += 3;
      signals.push('product-category');
    }

    // Model-like tokens
    if (MODEL_PATTERN.test(t)) {
      score += 2;
      signals.push('model');
    }

    // Memory
    if (MEMORY_PATTERN.test(t)) {
      score += 2;
      signals.push('memory');
    }

    // Quantity (including ranges)
    if (QTY_PATTERN.test(t) || QTY_RANGE_PATTERN.test(t)) {
      score += 2;
      signals.push('quantity');
    }

    // Price (including bare prices with context)
    if (PRICE_PATTERN.test(t)) {
      score += 2;
      signals.push('price');
    } else if (
      BARE_PRICE_PATTERN.test(t) &&
      (MEMORY_PATTERN.test(t) || MODEL_PATTERN.test(t))
    ) {
      score += 2;
      signals.push('bare-price');
    }

    // Condition / logistics
    if (CONDITION.some(c => t.includes(c))) {
      score += 1;
      signals.push('condition');
    }

    // Wholesale slang (low score, additive)
    if (WHOLESALE_SLANG.some(w => t.includes(w))) {
      score += 1;
      signals.push('wholesale-slang');
    }

    // List structure
    if (looksLikeStockList(text)) {
      score += 3;
      signals.push('list-structure');
    }

    /*
      CRITICAL RULE:
      We keep threshold LOW to avoid misses.
      Score >= 3 = Send to pipeline
    */
    const isBusiness = score >= 3;

    logger.debug('Business message analysis', {
      score,
      signals,
      isBusiness,
      preview: text.substring(0, 80)
    });

    return isBusiness;

  } catch (error) {
    logger.error('Error in business message filter', { error: error?.message || String(error) });
    // Fail safe - if filter crashes, send to pipeline
    return true;
  }
}
