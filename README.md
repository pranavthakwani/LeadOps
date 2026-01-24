# LeadOps - WhatsApp AI Workflow System

A comprehensive full-stack application that automates WhatsApp message processing using AI for lead generation and inventory management. The system consists of a Node.js backend with WhatsApp integration and a React frontend for dashboard management.

## Overview

LeadOps is a production-grade system that:
- Processes WhatsApp messages in real-time using AI-powered classification
- Extracts structured data from unstructured messages (products, prices, quantities)
- Separates buyer leads from seller offerings automatically
- Provides a web dashboard for data visualization and management
- Maintains 24/7 operation with robust error handling

## Architecture

### Backend (Node.js/Express)
- **WhatsApp Integration**: Real-time message listening via whatsapp-web.js
- **AI Processing**: OpenAI-powered message classification and data extraction
- **Database**: SQL Server for data persistence
- **API**: RESTful endpoints for frontend integration

### Frontend (React/TypeScript)
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS
- **Dashboard**: Real-time data visualization and management
- **Responsive**: Mobile-first design with Lucide icons
- **Build Tool**: Vite for fast development and production builds

## Features

### Backend Capabilities
- **WhatsApp Integration**: Real-time message listening via whatsapp-web.js
- **AI Classification**: OpenAI-powered message classification (lead/offering/noise)
- **Structured Extraction**: Automatic extraction of product details (brand, model, price, quantity, etc.)
- **Multi-Item Support**: Handles messages with multiple product variants in a single message
- **Range Detection**: Automatic parsing of price and quantity ranges
- **Brand Normalization**: Fuzzy matching against canonical brand list with automatic correction
- **Database Persistence**: Direct integration with SQL Server for all classifications
- **Webhook Support**: HTTP endpoint for external integrations
- **Broadcast Detection**: Identifies and processes business broadcast messages appropriately

### Frontend Features
- **Real-time Dashboard**: Live updates of processed messages and statistics
- **Lead Management**: View and manage buyer leads with detailed information
- **Inventory Tracking**: Monitor seller offerings and stock availability
- **Data Visualization**: Charts and graphs for business insights
- **Search & Filter**: Advanced filtering options for data management
- **Responsive Design**: Mobile-friendly interface for on-the-go access

### Reply Tracking System
- **Native WhatsApp Reply Detection**: Automatically detects when users reply to broadcast messages
- **Conversation Tracking**: Links replies to original broadcast messages for complete conversation history
- **No Workflow Disruption**: Reply tracking runs parallel to existing message processing
- **Database Integration**: Stores all reply data in dedicated `message_replies` table
- **CRM Ready**: Structured data for easy integration with CRM systems

## Project Structure

```
LeadOps/
├── Backend (Node.js)
│   ├── src/
│   │   ├── app.js                 # Express application setup
│   │   ├── server.js              # Server entry point
│   │   ├── config/
│   │   │   ├── env.js               # Environment validation and configuration
│   │   │   ├── supabase.js          # Supabase client singleton
│   │   │   ├── openai.js            # OpenAI client configuration
│   │   │   └── whatsapp.js          # WhatsApp configuration
│   │   ├── pipeline/               # Main processing pipeline
│   │   │   ├── 01-normalize-text.js                 # Message normalization
│   │   │   ├── 02-openai-understanding.js           # OpenAI API integration
│   │   │   ├── 03-parse-validate-json.js            # JSON parsing & initial validation
│   │   │   ├── 04-zod-schema-validation.js          # Zod schema validation
│   │   │   ├── 05-brand-variant-normalization.js    # Brand normalization & RAM/storage extraction
│   │   │   ├── 06-route-by-message-type.js          # Message routing
│   │   │   ├── 07-insert-to-db.js                   # Database insertion
│   │   │   └── index.js             # Pipeline orchestrator
│   │   ├── constants/
│   │   │   ├── enums.js             # Message types, actor types, table names
│   │   │   └── brands.js            # Canonical brands & brand mappings
│   │   ├── utils/
│   │   │   ├── logger.js            # Logging utility
│   │   │   └── json-parser.js       # Safe JSON parsing
│   │   └── services/                # Additional service modules
│   │   │   ├── reply-handler.js     # Reply detection and processing
│   │   │   ├── whatsapp.js          # WhatsApp client management
│   │   │   └── ...                  # Other service modules
│   ├── package.json                # Backend dependencies
│   ├── ecosystem.config.cjs         # PM2 configuration
│   └── sessions/                    # WhatsApp session storage
│
└── Frontend (React/TypeScript)
    ├── src/
    │   ├── components/              # React components
    │   ├── pages/                   # Page components
    │   ├── hooks/                   # Custom React hooks
    │   ├── utils/                   # Utility functions
    │   ├── types/                   # TypeScript type definitions
    │   └── main.tsx                 # Application entry point
    ├── public/                      # Static assets
    ├── package.json                # Frontend dependencies
    ├── vite.config.ts              # Vite configuration
    └── tailwind.config.js          # Tailwind CSS configuration
```

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# SQL Server Configuration
SQLSERVER_USER=KORE
SQLSERVER_PASSWORD=Kore@321
SQLSERVER_SERVER=182.16.16.21
SQLSERVER_DATABASE=Kore_Demo
SQLSERVER_PORT=1435
SQLSERVER_ENCRYPT=false
SQLSERVER_ENABLE_ARITH_ABORT=true
SQLSERVER_TRUST_SERVER_CERT=true
SQLSERVER_REQUEST_TIMEOUT=600000
SQLSERVER_POOL_MAX=10
SQLSERVER_POOL_MIN=0
SQLSERVER_POOL_IDLE_TIMEOUT=30000

# Supabase Configuration (kept for backup/migration)
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

- **SQLSERVER_USER**: SQL Server username (default: KORE)
- **SQLSERVER_PASSWORD**: SQL Server password (default: Kore@321)
- **SQLSERVER_SERVER**: SQL Server IP address (default: 182.16.16.21)
- **SQLSERVER_DATABASE**: Database name (default: Kore_Demo)
- **SQLSERVER_PORT**: SQL Server port (default: 1435)
- **SQLSERVER_ENCRYPT**: Whether to encrypt connection (default: false)
- **SQLSERVER_ENABLE_ARITH_ABORT**: Enable arithmetic abort (default: true)
- **SQLSERVER_TRUST_SERVER_CERT**: Trust server certificate (default: true)
- **SQLSERVER_REQUEST_TIMEOUT**: Request timeout in milliseconds (default: 600000)
- **SQLSERVER_POOL_MAX**: Maximum connection pool size (default: 10)
- **SQLSERVER_POOL_MIN**: Minimum connection pool size (default: 0)
- **SQLSERVER_POOL_IDLE_TIMEOUT**: Pool idle timeout in milliseconds (default: 30000)
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
- SQL Server with required tables
- OpenAI API account with gpt-4o-mini access

### Installation

#### Backend Setup

1. **Install backend dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Create a `.env` file in the project root with your credentials (see Environment Variables section)

3. **Create SQL Server tables** (if not already created):

   The system expects these tables to exist:

   - `dealer_leads` - Stores buyer lead information
   - `distributor_offerings` - Stores seller offering information
   - `ignored_messages` - Stores noise/irrelevant messages
   - `message_replies` - Tracks reply messages and conversations
   - `openai_usage_logs` - Logs OpenAI API usage and costs

   See Database Schema section for complete column definitions.

   **SQL Server Table Creation:**

   Execute the following SQL queries in your SQL Server database:

   ```sql
   -- dealer_leads table
   CREATE TABLE dealer_leads (
     id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
     sender NVARCHAR(255) NOT NULL,
     chat_id NVARCHAR(255) NOT NULL,
     chat_type NVARCHAR(50) NOT NULL,
     brand NVARCHAR(255) NULL,
     model NVARCHAR(255) NULL,
     variant NVARCHAR(255) NULL,
     ram NVARCHAR(50) NULL,
     storage NVARCHAR(50) NULL,
     colors NVARCHAR(MAX) NULL,
     price DECIMAL(18,2) NULL,
     quantity INT NULL,
     condition NVARCHAR(100) NULL,
     gst BIT NULL,
     dispatch NVARCHAR(255) NULL,
     raw_message NVARCHAR(MAX) NOT NULL,
     confidence DECIMAL(5,4) NULL,
     created_at DATETIME2 DEFAULT GETDATE(),
     price_min DECIMAL(18,2) NULL,
     price_max DECIMAL(18,2) NULL,
     quantity_min INT NULL,
     quantity_max INT NULL
   );

   -- distributor_offerings table (same structure as dealer_leads)
   CREATE TABLE distributor_offerings (
     id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
     sender NVARCHAR(255) NOT NULL,
     chat_id NVARCHAR(255) NOT NULL,
     chat_type NVARCHAR(50) NOT NULL,
     brand NVARCHAR(255) NULL,
     model NVARCHAR(255) NULL,
     variant NVARCHAR(255) NULL,
     ram NVARCHAR(50) NULL,
     storage NVARCHAR(50) NULL,
     colors NVARCHAR(MAX) NULL,
     price DECIMAL(18,2) NULL,
     quantity INT NULL,
     condition NVARCHAR(100) NULL,
     gst BIT NULL,
     dispatch NVARCHAR(255) NULL,
     raw_message NVARCHAR(MAX) NOT NULL,
     confidence DECIMAL(5,4) NULL,
     created_at DATETIME2 DEFAULT GETDATE(),
     price_min DECIMAL(18,2) NULL,
     price_max DECIMAL(18,2) NULL,
     quantity_min INT NULL,
     quantity_max INT NULL
   );

   -- ignored_messages table
   CREATE TABLE ignored_messages (
     id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
     sender NVARCHAR(255) NULL,
     chat_id NVARCHAR(255) NULL,
     chat_type NVARCHAR(50) NULL,
     raw_message NVARCHAR(MAX) NULL,
     confidence DECIMAL(5,4) NULL,
     created_at DATETIME2 DEFAULT GETDATE()
   );

   -- message_replies table
   CREATE TABLE message_replies (
     id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
     replied_by NVARCHAR(255) NOT NULL,
     replied_by_name NVARCHAR(255) NULL,
     replied_message NVARCHAR(MAX) NOT NULL,
     replied_at DATETIME2 DEFAULT GETDATE(),
     quoted_message_id NVARCHAR(255) NOT NULL,
     quoted_message_text NVARCHAR(MAX) NOT NULL,
     chat_type NVARCHAR(50) NOT NULL,
     source NVARCHAR(50) NOT NULL DEFAULT 'whatsapp'
   );

   -- openai_usage_logs table
   CREATE TABLE openai_usage_logs (
     id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
     wa_message_id NVARCHAR(255) NULL,
     model NVARCHAR(100) NULL,
     input_tokens INT NULL,
     output_tokens INT NULL,
     total_tokens INT NULL,
     cost_input_usd DECIMAL(10,6) NULL,
     cost_output_usd DECIMAL(10,6) NULL,
     cost_total_usd DECIMAL(10,6) NULL,
     latency_ms INT NULL,
     created_at DATETIME2 DEFAULT GETDATE(),
     raw_message NVARCHAR(MAX) NULL
   );
   ```

4. **Verify backend configuration**

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

#### Frontend Setup

1. **Navigate to frontend directory**

   ```bash
   cd Frontend
   ```

2. **Install frontend dependencies**

   ```bash
   npm install
   ```

3. **Start development server**

   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173`

#### Production Deployment

For production deployment, see the "Running with PM2" section for backend stability.

## Database Schema

### dealer_leads

```sql
CREATE TABLE public.dealer_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender text NOT NULL,
  chat_id text NOT NULL,
  chat_type text NOT NULL,
  brand text NULL,
  model text NULL,
  variant text NULL,
  ram text NULL,
  storage text NULL,
  colors jsonb NULL,
  price numeric NULL,
  quantity integer NULL,
  condition text NULL,
  gst boolean NULL,
  dispatch text NULL,
  raw_message text NOT NULL,
  confidence numeric NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  price_min numeric NULL,
  price_max numeric NULL,
  quantity_min integer NULL,
  quantity_max integer NULL,
  CONSTRAINT dealer_leads_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;
```

### distributor_offerings

```sql
CREATE TABLE public.distributor_offerings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender text NOT NULL,
  chat_id text NOT NULL,
  chat_type text NOT NULL,
  brand text NULL,
  model text NULL,
  variant text NULL,
  ram text NULL,
  storage text NULL,
  colors jsonb NULL,
  price numeric NULL,
  quantity integer NULL,
  condition text NULL,
  gst boolean NULL,
  dispatch text NULL,
  raw_message text NOT NULL,
  confidence numeric NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  price_min numeric NULL,
  price_max numeric NULL,
  quantity_min integer NULL,
  quantity_max integer NULL,
  CONSTRAINT distributor_offerings_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;
```

### ignored_messages

```sql
CREATE TABLE public.ignored_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender text NULL,
  chat_id text NULL,
  chat_type text NULL,
  raw_message text NULL,
  confidence numeric NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT ignored_messages_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;
```

### message_replies

```sql
CREATE TABLE public.message_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  replied_by text NOT NULL,
  replied_by_name text NULL,
  replied_message text NOT NULL,
  replied_at timestamp with time zone NULL DEFAULT now(),
  quoted_message_id text NOT NULL,
  quoted_message_text text NOT NULL,
  chat_type text NOT NULL,
  source text NOT NULL DEFAULT 'whatsapp'::text,
  CONSTRAINT message_replies_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;
```

### openai_usage_logs

```sql
CREATE TABLE public.openai_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wa_message_id text NULL,
  model text NULL,
  input_tokens integer NULL,
  output_tokens integer NULL,
  total_tokens integer NULL,
  cost_input_usd numeric NULL,
  cost_output_usd numeric NULL,
  cost_total_usd numeric NULL,
  latency_ms integer NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  raw_message text NULL,
  CONSTRAINT openai_usage_logs_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;
```

## Running the Application

### Backend Development

```bash
npm start
```

Starts the backend server on port 3000.

### Frontend Development

```bash
cd Frontend
npm run dev
```

Starts the frontend development server on port 5173.

### Production Mode

For production deployment, use PM2 for backend stability:

```bash
npm run pm2:start
```

## Running with PM2 (Production)

### Why PM2 is Required for WhatsApp Automation

WhatsApp automation without PM2 is unstable due to:

- **Session corruption** when process crashes or restarts manually
- **Multiple instances** causing session lock / EBUSY errors  
- **QR re-scan hell** with nodemon or dev mode restarts
- **WhatsApp Web reload** on app restarts

PM2 provides production-grade stability for long-running WhatsApp bots.

### PM2 Setup

1. **Install PM2 globally** (if not already installed):

```bash
npm install -g pm2
```

2. **Start with PM2**:

```bash
npm run pm2:start
```

3. **Monitor logs**:

```bash
npm run pm2:logs
```

### PM2 Commands

```bash
npm run pm2:start    # Start the bot with PM2
npm run pm2:stop     # Stop the bot
npm run pm2:restart  # Restart the bot
npm run pm2:logs     # View real-time logs
npm run pm2:delete   # Remove from PM2 process list
```

### PM2 Configuration

The `ecosystem.config.cjs` ensures:

- **Single instance only** (prevents duplicate WhatsApp connections)
- **No watch mode** (prevents unwanted restarts)
- **Graceful restarts** (5-second delay between restarts)
- **Production environment** (NODE_ENV=production)
- **Log files** (stored in `./logs/` directory)

### Expected Behavior with PM2

✅ **WhatsApp QR scanned once** - session persists across restarts  
✅ **24×7 operation** - no manual terminal required  
✅ **No duplicate connections** - single instance enforcement  
✅ **Session stability** - graceful crash handling  
✅ **Production logging** - structured log files  

### PM2 Use-Case Summary

- **Keeps WhatsApp bot alive** without reloading WhatsApp Web
- **Prevents accidental multiple logins** and session conflicts  
- **Eliminates QR re-scan hell** after crashes
- **Handles crashes safely** with automatic restarts
- **Required for any serious** WhatsApp automation deployment

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

### Main Message Processing
1. **Normalize Text** - Extract analysis_text from raw_text or normalized_text
2. **OpenAI Understanding** - Call OpenAI API with system prompt for classification
3. **Parse & Validate JSON** - Extract JSON from OpenAI response with error handling
4. **Zod Schema Validation** - Validate parsed JSON against schema
5. **Brand & Variant Normalization** - Normalize brands, extract RAM/storage, detect ranges
6. **Route by Message Type** - Determine target database table
7. **Insert to Database** - Write classified message to appropriate Supabase table

### Reply Tracking Process (Parallel)
1. **Reply Detection** - Monitor 1-to-1 messages for WhatsApp reply indicators
2. **Quoted Message Lookup** - Extract original message ID using `getQuotedMessage()`
3. **Original Message Search** - Find matching broadcast in `dealer_leads` or `distributor_offerings`
4. **Reply Storage** - Insert reply data into `message_replies` table with duplicate protection
5. **Logging** - Comprehensive logging for debugging and analytics

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

## Reply Tracking System

### Overview

The reply tracking system runs in parallel to the main message processing pipeline and automatically detects when users reply to broadcast messages. This enables complete conversation tracking without disrupting existing workflows.

### Key Features

- **Native WhatsApp Detection**: Uses WhatsApp's built-in reply detection (`hasQuotedMsg`, `getQuotedMessage()`)
- **Zero Workflow Disruption**: Reply tracking is completely additive and doesn't modify existing behavior
- **No OpenAI Usage**: Replies are processed without AI classification to save costs
- **Idempotent Operations**: Duplicate reply protection prevents data corruption
- **Production Safe**: Comprehensive error handling and logging

### How It Works

1. **Broadcast Message Storage**: All outgoing broadcasts are stored with their WhatsApp message ID
2. **Reply Detection**: When a 1-to-1 message arrives, the system checks if it's a reply using `message.hasQuotedMsg`
3. **Original Message Lookup**: If it's a reply, the system extracts the quoted message ID and searches for the original broadcast
4. **Reply Storage**: Found replies are stored in the `message_replies` table with full context
5. **Silent Processing**: Replies that don't match original broadcasts are silently ignored

### Database Schema for Replies

The `message_replies` table stores:
- **Reply Information**: Who replied, when, and what they said
- **Original Message Context**: Links back to the original broadcast
- **Contact Details**: Sender information including name when available
- **Timestamps**: Exact reply timing for analytics

### Future Extensions

This system enables:
- **CRM Integration**: Structured data ready for CRM system integration
- **Automated Follow-ups**: Foundation for intelligent reply automation
- **Analytics**: Reply rates, response times, and engagement metrics
- **Campaign Tracking**: Multi-broadcast campaign performance analysis

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

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: JavaScript (ES Modules)
- **Database**: SQL Server
- **AI**: OpenAI API (GPT-4o-mini)
- **WhatsApp**: whatsapp-web.js
- **Validation**: Zod
- **Process Management**: PM2

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Database Client**: mssql

## Development Notes

- Backend uses JavaScript with ES modules
- Frontend uses TypeScript for type safety
- Follows functional composition pattern for pipeline processing
- Uses environment-based configuration
- Implements comprehensive error handling and logging
- Designed for 24/7 operation with automatic recovery

## Future Enhancements

- Queue-based message processing (Bull, RabbitMQ)
- Webhook retries with exponential backoff
- Confidence threshold filtering
- Custom prompt templating
- Message deduplication
- Advanced analytics and reporting
- Mobile app development
- Multi-language support
- Integration with other messaging platforms

## License

Proprietary
