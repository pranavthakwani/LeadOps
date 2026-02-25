import { createLogger } from '../utils/logger.js';

const logger = createLogger('BusinessFilter');

// Step 1: Language Filter - Block non-English scripts
function isNonEnglishLanguage(text) {
  // Allow English script, Hinglish, Gujarati+English (all in English letters)
  // Block Devanagari, Arabic, Chinese, Cyrillic, etc.
  
  // Pattern to detect non-English scripts (Devanagari, Arabic, Chinese, Cyrillic, etc.)
  const NON_ENGLISH_SCRIPTS = /[\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF\u0400-\u04FF\u0590-\u05FF]/;
  
  // Allow if text contains only English letters, numbers, and common symbols
  if (NON_ENGLISH_SCRIPTS.test(text)) {
    return true; // Contains non-English script
  }
  
  return false; // English script only
}

// Step 2: Hard System/Non-Trade Filter - Drop OTP, banking, uploads, system junk
function isSystemOrNonTrade(text) {
  const t = text.toLowerCase();

  const SYSTEM_PATTERNS = [
    'otp',
    'verification code',
    'successfully processed',
    'uploaded',
    'processing your data',
    'transaction',
    'credited',
    'debited',
    'bank',
    'upi',
    'payment',
    'balance',
    'invoice generated',
    'report generated',
    'cron job',
    'api response',
    'server started',
    'error:',
    'exception:',
    'http://',
    'https://'
  ];

  if (SYSTEM_PATTERNS.some(p => t.includes(p))) {
    return true;
  }

  // Pure numeric transaction style messages
  if (/^\d{6,}$/.test(t.trim())) return true;

  return false;
}

// Step 2: Hard Safe Filter - Only drop clearly impossible messages
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

// Model / Variant Signals (TIGHTENED - only with brand context)
const MODEL_PATTERN = /\b[a-z]{0,3}\d{1,3}[a-z]{0,3}\b/i; // 13, A13, Z10x, F27

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

// Multi-line / List Structure Signal (IMPROVED - requires structured trading)
function looksLikeStockList(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 3) return false;

  let validLines = 0;

  for (const line of lines) {
    const l = line.toLowerCase();

    if (
      (MEMORY_PATTERN.test(l) || MODEL_PATTERN.test(l)) &&
      (PRICE_PATTERN.test(l) || BARE_PRICE_PATTERN.test(l) || QTY_PATTERN.test(l))
    ) {
      validLines++;
    }
  }

  return validLines >= 2;
}

// Step 3: Confidence Accumulator (designed to never miss)
export function isBusinessMessage(text) {
  try {
    if (!text) return false;

    // Language filter
    if (isNonEnglishLanguage(text)) return false;

    // Hard negative
    if (isSystemOrNonTrade(text)) return false;

    if (isObviouslyNonBusiness(text)) return false;

    const t = text.toLowerCase();
    let score = 0;
    const signals = [];

    // 🔹 Improved trade intent (fuzzy)
    const TRADE_INTENT_REGEX =
      /\b(wtb|wts|sale|sell|buy|available|stock|dispatch|ready|offer|deal|quote|rate|rates|price|required|requred|req|need|enquiry)\b/i;

    if (TRADE_INTENT_REGEX.test(t)) {
      score += 4;
      signals.push('trade-intent');
    }

    // 🔹 Brand presence (still strong)
    if (BRANDS.some(b => t.includes(b))) {
      score += 3;
      signals.push('brand');
    }

    // 🔹 Model-like token (NO brand requirement now)
    if (MODEL_PATTERN.test(t)) {
      score += 2;
      signals.push('model-like');
    }

    // 🔹 Memory
    if (MEMORY_PATTERN.test(t)) {
      score += 2;
      signals.push('memory');
    }

    // 🔹 Quantity
    if (QTY_PATTERN.test(t) || QTY_RANGE_PATTERN.test(t)) {
      score += 2;
      signals.push('quantity');
    }

    // 🔹 Price (improved to detect "30k", "45k")
    const PRICE_WITH_K = /\b\d{2,3}k\b/i;
    const IMPROVED_PRICE_PATTERN = /(₹|rs\.?|@)\s?\d{3,6}/i;

    if (IMPROVED_PRICE_PATTERN.test(t) || PRICE_WITH_K.test(t)) {
      score += 3;
      signals.push('price');
    }

    // 🔹 Bare price with context (price + quantity OR memory)
    if (
      BARE_PRICE_PATTERN.test(t) &&
      (MEMORY_PATTERN.test(t) || QTY_PATTERN.test(t))
    ) {
      score += 2;
      signals.push('bare-price-context');
    }

    // 🔹 Combo boost (critical)
    if (
      (QTY_PATTERN.test(t) || QTY_RANGE_PATTERN.test(t)) &&
      (PRICE_WITH_K.test(t) || IMPROVED_PRICE_PATTERN.test(t))
    ) {
      score += 3;
      signals.push('qty+price-boost');
    }

    // 🔹 Multiline structure boost
    if (looksLikeStockList(text)) {
      score += 3;
      signals.push('list-structure');
    }

    if (text.split('\n').length >= 3) {
      score += 1;
      signals.push('multiline');
    }

    /*
      🔥 NEW THRESHOLD LOGIC
      Lower threshold because we prioritize recall.
      If price + qty OR trade intent → always pass.
    */

    const strongSignal =
      (PRICE_WITH_K.test(t) || IMPROVED_PRICE_PATTERN.test(t)) &&
      (QTY_PATTERN.test(t) || QTY_RANGE_PATTERN.test(t));

    const isBusiness =
      strongSignal ||
      TRADE_INTENT_REGEX.test(t) ||
      score >= 4;

    logger.debug('Business message analysis', {
      score,
      signals,
      strongSignal,
      isBusiness,
      preview: text.substring(0, 80)
    });

    return isBusiness;

  } catch (error) {
    logger.error('Error in business message filter', {
      error: error?.message || String(error)
    });
    return true; // fail-safe
  }
}
