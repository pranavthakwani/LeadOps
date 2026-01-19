# WhatsApp Broadcast Reply Tracking Implementation

## Overview
This implementation adds reply tracking functionality to the existing WhatsApp workflow without modifying any existing behavior.

## Database Changes

### 1. New Migration Files Created

#### `04_add_wa_message_id_to_existing_tables.sql`
- Adds `wa_message_id` column to `dealer_leads` and `distributor_offerings` tables
- Creates indexes for faster lookups

#### `05_create_message_replies_table.sql`
- Creates new `message_replies` table with the following schema:
  - `id` (uuid, primary key)
  - `original_table` (text) - 'dealer_leads' or 'distributor_offerings'
  - `original_row_id` (uuid) - References original message
  - `original_wa_message_id` (text) - WhatsApp ID of broadcast message
  - `reply_wa_message_id` (text) - WhatsApp ID of reply (unique)
  - `contact_number` (text) - Who replied
  - `contact_name` (text, nullable) - Contact name
  - `reply_text` (text) - Reply content
  - `created_at` (timestamp) - When reply was received

## Code Changes

### 1. New Service: `src/services/reply-handler.js`
- `findOriginalMessage()` - Locates original broadcast message by WhatsApp ID
- `saveReply()` - Inserts reply into database with duplicate protection
- `processReply()` - Main function to handle reply detection and saving

### 2. Updated: `src/services/whatsapp.js`
- Added reply handler import
- Modified 1-to-1 message handling to check for replies
- Added WhatsApp message ID to all pipeline payloads
- Both `message` and `message_create` events handle replies

### 3. Updated: `src/pipeline/07-insert-to-db.js`
- Added `wa_message_id` field to database payloads
- Ensures all new leads/offerings track their WhatsApp message ID

## How It Works

### Existing Workflow (UNCHANGED)
1. Broadcast messages → AI classification → Parsing → Database storage
2. Group messages → Same pipeline
3. All existing logic, prompts, and routing remain identical

### New Reply Workflow (PARALLEL)
1. 1-to-1 message arrives
2. Check `message.hasQuotedMsg`
3. If true:
   - Get quoted message ID via `message.getQuotedMessage()`
   - Search `dealer_leads` and `distributor_offerings` for matching `wa_message_id`
   - If found, insert into `message_replies` table
   - If not found, silently ignore
4. If false, ignore message

## Key Features

### ✅ Requirements Met
- Native WhatsApp reply detection (`hasQuotedMsg`, `getQuotedMessage()`)
- No changes to existing workflow
- No OpenAI usage for replies
- No auto-replies or automation
- Idempotent inserts (duplicate protection)
- Production-safe error handling

### ✅ Scalability
- Clean separation of concerns
- Modular design for future CRM integration
- Indexed database queries
- Comprehensive logging

### ✅ Safety
- All new functionality is additive
- Existing pipeline completely untouched
- Graceful error handling
- No data migration required

## Testing

The implementation includes comprehensive logging and can be tested by:

1. Running the database migrations
2. Sending a broadcast message (will be stored with wa_message_id)
3. Replying to that broadcast in a 1-to-1 chat
4. Checking the `message_replies` table for the new record

## Future Extensions

This design enables easy future additions:
- CRM integration via `message_replies` table
- Automated follow-up workflows
- Reply analytics and reporting
- Multi-broadcast campaign tracking
