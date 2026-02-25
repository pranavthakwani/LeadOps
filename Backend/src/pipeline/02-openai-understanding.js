import axios from 'axios';
import { getOpenAIConfig } from '../config/openai.js';
import { createLogger } from '../utils/logger.js';
import { safeJSONParse } from '../utils/json-parser.js';
import { logOpenAIUsage } from '../services/openai-usage-logger.js';
import { isMessageAlreadyProcessed, markMessageAsProcessed } from '../utils/message-dedupe.js';

const logger = createLogger('OpenAI Understanding');

const SYSTEM_PROMPT = `
You extract structured wholesale mobile electronics data from WhatsApp messages.

Return valid JSON only. No explanations. No markdown.

You MUST populate all required top-level fields:
- is_business_message
- message_type
- actor_type
- brand
- condition
- gst
- dispatch
- items[]
- confidence
- source

Core Classification Rules:

1. Classify message_type correctly:
   - Offerings typically include price and quantity.
   - Leads typically include intent words like "required", "need", "want".
   - Price alone does NOT determine type.
   - Always prioritize strong intent indicators over numeric presence.

2. Each sellable SKU must be a separate object inside items[].

3. Evaluate each item independently.
   - Do NOT assume all SKUs belong to the same brand.
   - Do NOT group multiple models under one brand unless explicitly stated.

Normalization Rules:

- Normalize casing, spacing, and minor formatting.
- Treat small variations as same model:
  "air m1", "AirM1", "macbook m1" → "MacBook Air M1"
- Normalize abbreviations:
  "sam", "smg" → "Samsung"
- Use obvious emoji hints (🍎 → Apple).
- Preserve alphanumeric suffixes (15T, 11X, 12C).
- Do not invent missing model parts.

Brand Inference Rules:

- Infer brand ONLY when series ownership is strong and unique.
- If ambiguous across brands, set brand = null.
- Do NOT force single-brand assignment across multiple items.
- Do NOT convert one brand family into another.

Strict Series Ownership (for disambiguation):

Apple:
- iPhone, Pro, Pro Max, Plus, SE
- Model codes A####

Samsung:
- Galaxy S, Z, A, M, F
- Codes SM-

Xiaomi:
- Redmi, Redmi Note, Redmi K, Redmi A, Xiaomi
- Date-based 23xx or older M codes

Realme:
- GT, Number Series, P Series, C Series
- Codes RMX####

Oppo:
- Find X, Find N, Reno, F, A, K
- Codes CPH####

Vivo:
- X, V, T, Y
- Codes V####

Tecno:
- Phantom, Camon, Pova, Spark, Pop

Infinix:
- GT, Zero, Note, Hot, Smart

Itel:
- S, P, A, Vision

Lava:
- Agni, Blaze, Yuva, Storm, O

Ai+:
- Pulse, Nova

Nokia:
- G, C, X, XR
- Codes TA-####

Motorola:
- Razr, Edge, Moto G, Moto E
- Codes XT####

Poco:
- F, X, M, C

OnePlus:
- Number Series, R Series, Nord, Nord CE, Open

Narzo:
- Narzo N, Narzo x0, Narzo A
- Shares RMX pattern but do NOT override clear Realme indicators

Google:
- Pixel, Pixel Pro, Pixel a, Pixel Fold
- Codes G####

If multiple brand families appear in one message, assign brand per item separately.

Correct minor spelling mistakes in brand or model names when the intended series or brand is clearly identifiable (edit-distance ≤ 1). If correction is uncertain or multiple valid matches exist, do NOT guess and keep original.

Parsing Rules:

- Parse RAM/storage (8/128 → ram=8, storage=128).
- Parse price and quantity (single or range).
- Split multi-line SKU lists.
- Unknown values must be null.
- Never fabricate missing data.

Confidence:

- High confidence when brand and model are explicit.
- Medium when inference required.
- Low when ambiguous.

Output JSON ONLY.
`;

export const openaiUnderstanding = async (payload) => {
  try {
    // Deduplication: Check if message already processed
    const wa_message_id = payload.body?.wa_message_id || 'unknown';
    if (await isMessageAlreadyProcessed(wa_message_id)) {
      logger.info('Message already processed, skipping OpenAI call', { wa_message_id });
      return {
        ...payload,
        openai_error: 'Message already processed',
        output: []
      };
    }

    // Mark as processed to prevent duplicate calls
    markMessageAsProcessed(wa_message_id);

    const config = getOpenAIConfig();
    const analysisText = payload.body?.raw_text ?? '';
    const sender = payload.body?.sender || 'unknown';
    const chatId = payload.body?.chat_id || 'unknown';
    const chatType = payload.body?.chat_type || 'unknown';
    const rawText = (payload.body?.raw_text || '').slice(0, 1500);

const userPrompt = `
Extract structured JSON from this WhatsApp message:

"""${rawText}"""

Interpret naturally and normalize brand/model to most likely real product names.

Return JSON EXACTLY matching this schema:

{
  "is_business_message": true | false,
  "message_type": "lead" | "offering" | "noise",
  "actor_type": "dealer" | "distributor" | "unknown",
  "brand": null,
  "condition": "fresh" | "used" | "unknown" | null,
  "gst": true | false | null,
  "dispatch": "today" | "tomorrow" | "unknown" | null,
  "items": [
    {
      "brand": null,
      "model": null,
      "variant": null,
      "ram": null,
      "storage": null,
      "colors": {},
      "price": null,
      "price_min": null,
      "price_max": null,
      "quantity": null,
      "quantity_min": null,
      "quantity_max": null,
      "dispatch": null
    }
  ],
  "confidence": 0.0,
  "source": {
    "sender": "${sender}",
    "chat_id": "${chatId}",
    "chat_type": "${chatType}",
    "raw_message": "${rawText}"
  }
}

Output JSON ONLY.
`;

    const postOnce = () => axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: config.maxTokens,
        temperature: 0
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const sleep = (ms) => new Promise(res => setTimeout(res, ms));
    let response;
    let attempt = 0;
    const maxAttempts = 3;
    const startTime = performance.now();

    while (attempt < maxAttempts) {
      try {
        response = await postOnce();
        break;
      } catch (err) {
        const status = err?.response?.status;
        attempt += 1;
        if (status === 429 || (status >= 500 && status < 600) || !status) {
          if (attempt < maxAttempts) {
            const backoff = 500 * Math.pow(2, attempt - 1);
            logger.warn('OpenAI request retrying', { attempt, backoffMs: backoff, status });
            await sleep(backoff);
            continue;
          }
        }
        throw err;
      }
    }

    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    const content = response.data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Debug: Log raw response to see usage structure
    console.log('RAW OPENAI RESPONSE USAGE:', response.data?.usage);

    // Log OpenAI usage on successful response
    if (response.data?.usage) {
      const usageData = {
        wa_message_id: payload.body?.wa_message_id || 'unknown',
        model: config.model,
        input_tokens: response.data.usage.prompt_tokens || 0,
        output_tokens: response.data.usage.completion_tokens || 0,
        cached_tokens: response.data.usage.prompt_tokens_details?.cached_tokens || 0,
        latency_ms: latencyMs,
        raw_message: payload.raw_text || null
      };

      // Log asynchronously to avoid blocking
      logOpenAIUsage(usageData).catch(err => {
        logger.error('Failed to log OpenAI usage', { error: err });
      });
    }

    const parsed = safeJSONParse(content);

    if (!parsed) {
      throw new Error('Failed to parse OpenAI JSON response');
    }

    return {
      ...payload,
      output: [
        {
          content: [
            {
              text: content
            }
          ]
        }
      ]
    };

  } catch (error) {
    logger.error('OpenAI API call failed', error);

    return {
      ...payload,
      openai_error: error instanceof Error ? error.message : String(error),
      output: [
        {
          content: [
            {
              text: JSON.stringify({
                is_business_message: false,
                message_type: 'noise',
                actor_type: payload.body?.actor_type || 'unknown',
                brand: null,
                condition: null,
                gst: null,
                dispatch: null,
                items: [],
                confidence: 0,
                source: {
                  sender: payload.body?.sender || 'unknown',
                  chat_id: payload.body?.chat_id || 'unknown',
                  chat_type: payload.body?.chat_type || 'unknown',
                  raw_message: payload.body?.raw_text || payload.body?.normalized_text || ''
                }
              })
            }
          ]
        }
      ]
    };
  }
};
