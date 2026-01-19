# WhatsApp AI Workflow

Production-grade Node.js application that processes WhatsApp messages using OpenAI for classification and structured extraction. Functionally equivalent to the n8n workflow with 100% behavioral parity.

## Features

- **WhatsApp Integration**: Real-time message listening via whatsapp-web.js
- **AI Classification**: OpenAI-powered message classification (lead/offering/noise)
- **Structured Extraction**: Automatic extraction of product details (brand, model, price, quantity, etc.)
- **Multi-Item Support**: Handles messages with multiple product variants in a single message
- **Range Detection**: Automatic parsing of price and quantity ranges
- **Brand Normalization**: Fuzzy matching against canonical brand list with automatic correction
- **Database Persistence**: Direct integration with Supabase for all classifications
- **Webhook Support**: HTTP endpoint for external integrations
- **Broadcast Detection**: Identifies and processes business broadcast messages appropriately

## Project Structure

```
/src
  /app.js                 # Express application setup
  /server.js              # Server entry point

  /config
    /env.js               # Environment validation and configuration
    /supabase.js          # Supabase client singleton
    /openai.js            # OpenAI client configuration
    /whatsapp.js          # WhatsApp configuration

  /pipeline               # Main processing pipeline
    /01-normalize-text.js                 # Message normalization
    /02-openai-understanding.js           # OpenAI API integration
    /03-parse-validate-json.js            # JSON parsing & initial validation
    /04-zod-schema-validation.js          # Zod schema validation
    /05-brand-variant-normalization.js    # Brand normalization & RAM/storage extraction
    /06-route-by-message-type.js          # Message routing
    /07-insert-to-db.js                   # Database insertion
    /index.js             # Pipeline orchestrator

  /constants
    /enums.js             # Message types, actor types, table names
    /brands.js            # Canonical brands & brand mappings

  /utils
    /logger.js            # Logging utility
    /json-parser.js       # Safe JSON parsing
```

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=4000

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=./sessions
TARGET_BUSINESS_NAME=optional-business-name

# Server Configuration
WEBHOOK_PORT=3000
LOG_LEVEL=info
```

### Configuration Details

- **SUPABASE_URL**: Your Supabase project URL
- **SUPABASE_ANON_KEY**: Public API key for Supabase
- **SUPABASE_SERVICE_ROLE_KEY**: Service role key with full database access
- **OPENAI_API_KEY**: Your OpenAI API key (must have gpt-4o-mini access)
- **OPENAI_MODEL**: Model to use (default: gpt-4o-mini, supports any OpenAI model)
- **OPENAI_MAX_TOKENS**: Maximum tokens per request (default: 4000)
- **WHATSAPP_SESSION_PATH**: Directory for WhatsApp session files
- **TARGET_BUSINESS_NAME**: (Optional) Filter messages by business name
- **WEBHOOK_PORT**: Express server port (default: 3000)
- **LOG_LEVEL**: Logging level (debug, info, warn, error)

## Setup Instructions

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Supabase project with required tables
- OpenAI API account with gpt-4o-mini access

### Installation

1. **Clone and install dependencies**

   ```bash
   npm install
   ```
2. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your actual credentials
   ```
3. **Create Supabase tables** (if not already created):

   The system expects these tables to exist:

   - `dealer_leads`
   - `distributor_offerings`
   - `ignored_messages`

   See Database Schema section for column definitions.
4. **Verify configuration**

   ```bash
   npm start
   ```

   Should output:

   ```
   [INFO] [Server] Server started on port 3000
   [INFO] [Server] Available endpoints:
   [INFO] [Server]   GET  /health
   [INFO] [Server]   POST /whatsapp-ai
   ```

## Database Schema

### dealer_leads

```sql
CREATE TABLE dealer_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender text,
  chat_id text,
  chat_type text,
  brand text,
  model text,
  variant text,
  ram integer,
  storage integer,
  colors jsonb,
  quantity integer,
  quantity_min integer,
  quantity_max integer,
  price numeric,
  price_min numeric,
  price_max numeric,
  condition text,
  gst boolean,
  dispatch text,
  confidence numeric,
  raw_message text,
  created_at timestamp default now()
);
```

### distributor_offerings

Same structure as `dealer_leads`

### ignored_messages

```sql
CREATE TABLE ignored_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender text,
  chat_id text,
  chat_type text,
  confidence numeric,
  raw_message text,
  created_at timestamp default now()
);
```

## Running the Application

### Development Mode

```bash
npm run dev
```

Uses `--watch` flag for automatic restart on file changes.

### Production Mode

```bash
npm start
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-06T10:30:00.000Z"
}
```

### Process WhatsApp Message

```bash
POST /whatsapp-ai
Content-Type: application/json

{
  "sender": "1234567890@c.us",
  "chat_id": "1234567890@c.us",
  "chat_type": "individual",
  "raw_text": "Samsung S23 Ultra fresh stock 12/512 @ 89000-91000, 50 pcs available",
  "normalized_text": "samsung s23 ultra fresh stock 12/512 @ 89000-91000, 50 pcs available",
  "is_broadcast": false
}
```

Response:

```json
{
  "success": true,
  "message": "Message processed",
  "itemsProcessed": 1
}
```

## Pipeline Execution Flow

1. **Normalize Text** - Extract analysis_text from raw_text or normalized_text
2. **OpenAI Understanding** - Call OpenAI API with system prompt for classification
3. **Parse & Validate JSON** - Extract JSON from OpenAI response with error handling
4. **Zod Schema Validation** - Validate parsed JSON against schema
5. **Brand & Variant Normalization** - Normalize brands, extract RAM/storage, detect ranges
6. **Route by Message Type** - Determine target database table
7. **Insert to Database** - Write classified message to appropriate Supabase table

## Classification Rules

### Message Types

- **lead**: Buyer intent messages ("need", "required", "looking for", "chahiye")
- **offering**: Seller stock messages ("pcs @", "available", "fresh stock")
- **noise**: Greetings, emojis, acknowledgements, unclear text

### Actor Types

- **dealer**: Buyer/retailer requesting stock
- **distributor**: Seller/wholesaler offering stock
- **unknown**: Cannot be reliably determined

### Confidence Scoring

- Single item, clear terms: 0.80–0.90
- Multiple items, ranges, mixed formats: 0.60–0.75
- Heavy ambiguity: 0.50–0.60
- Non-business messages: 0 (or custom value)

## Error Handling

- **OpenAI API failures**: Automatically convert message to "noise" and insert to ignored_messages
- **Validation failures**: Convert to "noise" with error details
- **Database errors**: Logged but don't crash the pipeline
- **Malformed payloads**: Return error response without processing

## Broadcast Handling

Broadcast messages are detected via whatsapp-web.js metadata:

- Messages from broadcast lists are identified
- Processing continues normally (no special filtering)
- No auto-replies are sent to broadcasts
- Broadcast flag is NOT stored in database (design decision per requirements)

## Range Detection

### Quantity Ranges

Detects patterns like: "80-100 pcs", "40–60", "80 to 100"

- Range detected → quantity = null, quantity_min = lower, quantity_max = upper
- Single value → quantity = value, quantity_min = value, quantity_max = value
- No quantity → all null

### Price Ranges

Detects patterns like: "₹45000-47000", "45k-47k", "45000 to 47000"

- Range detected → price = null, price_min = lower, price_max = upper
- Single value → price = value, price_min = value, price_max = value
- No price → all null

## Brand Normalization

Uses fuzzy matching with Levenshtein distance (≤2) against canonical brand list:

- Direct matches: "samsung" → "Samsung"
- Shorthand: "mi" → "Xiaomi"
- Fuzzy: "samsung" → "Samsung"
- Unknown brands: preserved as-is

## Logging

Logs are written to console with levels:

```
[LEVEL] [Module] Message Data
```

Set `LOG_LEVEL` environment variable to control verbosity:

- **debug**: All messages
- **info**: Info level and above
- **warn**: Warnings and errors only
- **error**: Errors only

## Performance Considerations

- **One OpenAI call per message**: Efficient API usage
- **Stateless processing**: Each message processed independently
- **Async DB writes**: Non-blocking database operations
- **No retries**: Process once, log failures
- **Scalable architecture**: Ready for queue-based processing (future enhancement)

## Troubleshooting

### "Missing OpenAI API key"

Ensure `OPENAI_API_KEY` is set in `.env` file.

### "Cannot connect to Supabase"

Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct.

### "OpenAI API returns invalid JSON"

The system automatically converts such messages to "noise" category.

### "Message not appearing in database"

Check:

1. Log level is set to at least "info"
2. Supabase connection is working (check /health endpoint)
3. Message classification was correct (check ignored_messages table)

## Development Notes

- All code is JavaScript (no TypeScript)
- Uses Express.js for HTTP handling
- Uses Supabase JS client for database operations
- Uses Zod for validation (schema validation only, not enforcement)
- Follows functional composition pattern for pipeline

## Future Enhancements

- Queue-based message processing (Bull, RabbitMQ)
- Webhook retries with exponential backoff
- Confidence threshold filtering
- Custom prompt templating
- Message deduplication
- Advanced analytics

## License

Proprietary
