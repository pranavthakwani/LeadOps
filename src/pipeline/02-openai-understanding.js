import axios from 'axios';
import { getOpenAIConfig } from '../config/openai.js';
import { createLogger } from '../utils/logger.js';
import { safeJSONParse } from '../utils/json-parser.js';
import { logOpenAIUsage } from '../services/openai-usage-logger.js';
import { isMessageAlreadyProcessed, markMessageAsProcessed } from '../utils/message-dedupe.js';

const logger = createLogger('OpenAI Understanding');

const SYSTEM_PROMPT = `
You are a strict JSON-only extraction engine for WhatsApp wholesale mobile trading messages.

Rules (ABSOLUTE):
- Output valid JSON only
- No explanations or markdown
- Never guess or infer
- Unknown values → null
- Missing colors → {}
- Penalize ambiguity honestly

Classification:
- is_business_message: true | false
- message_type: lead | offering | noise
- actor_type: dealer | distributor | unknown

Structure:
- Use "items[]" when multiple SKUs exist
- Each item = one sellable SKU

Quantity:
- Range → quantity=null, quantity_min, quantity_max
- Single → quantity=value and min=max=value
- Missing → all null

Price:
- Range → price=null, price_min, price_max
- Single → price=value and min=max=value
- Missing → all null

Top-level fields ONLY if common to all items:
brand, condition, gst, dispatch

Item-level fields:
brand, model, variant, ram, storage, colors, price*, quantity*, dispatch*

Confidence:
- Single clear item → 0.80–0.90
- Multiple items or ranges → 0.60–0.75
- Heavy ambiguity → 0.50–0.60
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

    // Pre-filter: Skip OpenAI for obvious non-business messages
    const text = rawText.toLowerCase();
    const likelyBusiness = /\b(pcs|pc|@|₹|rs|gst|stock|available|need|req|price)\b/.test(text);
    
    if (!likelyBusiness) {
      const noiseResponse = {
        is_business_message: false,
        message_type: 'noise',
        actor_type: 'unknown',
        brand: null,
        condition: null,
        gst: null,
        dispatch: null,
        items: [],
        confidence: 0,
        source: {
          sender,
          chat_id: chatId,
          chat_type: chatType,
          raw_message: rawText
        }
      };
      
      return {
        ...payload,
        output: [{
          content: [{ text: JSON.stringify(noiseResponse) }]
        }]
      };
    }

    const userPrompt = `
Extract structured JSON for this message:

"""${rawText}"""

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
