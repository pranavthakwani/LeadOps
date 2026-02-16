import { getSQLPool } from '../config/sqlserver.js';
import { DB_TABLES } from '../constants/enums.js';
import { OPENAI_PRICING } from '../config/openai-pricing.js';
import { createLogger } from '../utils/logger.js';

let logger;

function getLogger() {
  if (!logger) {
    logger = createLogger('OpenAI Usage');
  }
  return logger;
}

/**
 * Format OpenAI usage data as table for console output
 * @param {Object} data - Usage data
 */
const logOpenAIUsageTable = (data) => {
  const {
    wa_message_id = 'N/A',
    model = 'N/A',
    input_tokens = 0,
    cached_tokens = 0,
    uncached_input_tokens = 0,
    output_tokens = 0,
    total_tokens = 0,
    cost_total_usd = 0,
    latency_ms = 0
  } = data;

  const costInINR = cost_total_usd * 90;
  const truncatedId = wa_message_id.length > 40 ? wa_message_id.substring(0, 37) + '...' : wa_message_id;
  
  console.log(`┌──────────────────────── OpenAI Usage ────────────────────────┐`);
  console.log(`│ Message ID     │ ${truncatedId.padEnd(45)}                `);
  console.log(`│ Model          │ ${model.padEnd(20)}                                  `);
  console.log(`│ Input Tokens   │ ${input_tokens.toString().padEnd(10)}  (cached: ${cached_tokens.toString().padEnd(3)} | uncached: ${uncached_input_tokens.toString().padEnd(3)})             `);
  console.log(`│ Output Tokens  │ ${output_tokens.toString().padEnd(10)}                                          `);
  console.log(`│ Total Tokens   │ ${total_tokens.toString().padEnd(10)}                                          `);
  console.log(`│ Cost (USD)     │ $${cost_total_usd.toFixed(6).padStart(8)}                                    `);
  console.log(`│ Cost (INR)     │ ₹${costInINR.toFixed(2).padStart(8)}                                        `);
  console.log(`│ Latency        │ ${latency_ms.toString().padEnd(10)} ms                                      `);
  console.log(`└──────────────────────────────────────────────────────────────┘`);
};

/**
 * Log OpenAI usage to database
 * @param {Object} usageData - Usage data from OpenAI response
 * @param {string} usageData.wa_message_id - WhatsApp message ID
 * @param {string} usageData.model - OpenAI model used
 * @param {number} usageData.input_tokens - Input tokens used
 * @param {number} usageData.output_tokens - Output tokens used
 * @param {number} usageData.latency_ms - Request latency in milliseconds
 * @param {string} usageData.raw_message - Raw message text (optional)
 * @param {number} usageData.cached_tokens - Cached tokens used (optional)
 */
export const logOpenAIUsage = async (usageData) => {
  try {
    const { wa_message_id, model, input_tokens, output_tokens, latency_ms, raw_message } = usageData;
    
    // Get pricing for model
    const pricing = OPENAI_PRICING[model];
    if (!pricing) {
      getLogger().warn('No pricing found for model', { model });
      return;
    }
    
    // Extract tokens from usageData (passed from OpenAI response)
    const prompt_tokens = input_tokens || 0;
    const completion_tokens = output_tokens || 0;
    const cached_tokens = usageData.cached_tokens || 0;
    const uncached_input_tokens = Math.max(0, prompt_tokens - cached_tokens);
    const total_tokens = prompt_tokens + completion_tokens;
    
    // Calculate costs with cached token pricing
    const cost_input_uncached = uncached_input_tokens * pricing.input;
    const cost_input_cached = cached_tokens * pricing.input_cached;
    const cost_output = completion_tokens * pricing.output;
    const cost_total = cost_input_uncached + cost_input_cached + cost_output;
    
    // Round costs to 6 decimal places
    const roundedCostInput = Math.round((cost_input_uncached + cost_input_cached) * 1000000) / 1000000;
    const roundedCostOutput = Math.round(cost_output * 1000000) / 1000000;
    const roundedCostTotal = Math.round(cost_total * 1000000) / 1000000;
    
    // Insert into SQL Server database
    try {
      const pool = getSQLPool();
      
      const payload = {
        wa_message_id,
        model,
        input_tokens,
        output_tokens,
        total_tokens,
        cost_input_usd: roundedCostInput,
        cost_output_usd: roundedCostOutput,
        cost_total_usd: roundedCostTotal,
        latency_ms,
        raw_message: raw_message || null
      };

      // Build dynamic INSERT query based on payload
      const columns = Object.keys(payload).filter(key => payload[key] !== null && payload[key] !== undefined);
      const values = columns.map(key => payload[key]);
      
      if (columns.length === 0) {
        getLogger().warn('No valid columns to insert for OpenAI usage log');
        return;
      }

      const placeholders = columns.map((_, index) => `@param${index}`).join(', ');
      const columnNames = columns.join(', ');
      
      const query = `
        INSERT INTO ${DB_TABLES.OPENAI_USAGE_LOGS} (${columnNames})
        VALUES (${placeholders})
      `;

      // Create parameterized request
      const request = pool.request();
      values.forEach((value, index) => {
        request.input(`param${index}`, value);
      });

      await request.query(query);
      
    } catch (dbError) {
      getLogger().error('Failed to insert OpenAI usage log to SQL Server', { error: dbError, wa_message_id });
      // Don't rethrow - we still want to log to console
    }
    
    // Log to console with table format
    logOpenAIUsageTable({
      wa_message_id,
      model,
      input_tokens,
      cached_tokens,
      uncached_input_tokens,
      output_tokens,
      total_tokens,
      cost_total_usd: roundedCostTotal,
      latency_ms
    });
    
  } catch (error) {
    getLogger().error('Error logging OpenAI usage to SQL Server', { error, wa_message_id: usageData.wa_message_id });
  }
};
