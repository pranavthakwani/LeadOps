# Environment Configuration for Broadcast List

## Required Environment Variable

Add this to your `.env` file:

```bash
WHATSAPP_TARGET_BROADCAST_LIST_NAME=ABCD
```

## Available Environment Variables

### WhatsApp Configuration
- `WHATSAPP_SESSION_PATH` - Path to WhatsApp session storage
- `WHATSAPP_TARGET_GROUP_NAME` - Target group name (optional, for legacy group support)
- `WHATSAPP_TARGET_BROADCAST_LIST_NAME` - Target broadcast list name (set to "ABCD")

### Other Required Variables
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_MAX_TOKENS`
- `WEBHOOK_PORT`
- `LOG_LEVEL`

## How It Works

1. **Broadcast List Detection**: The system now checks if messages come from the specified broadcast list "ABCD"
2. **Message Processing**: Messages from "ABCD" broadcast list are processed through the AI pipeline
3. **Reply Tracking**: Replies to these broadcast messages are tracked in the `message_replies` table
4. **Backward Compatibility**: Still supports group-based processing if needed

## Priority Order

The system processes messages in this order:

1. **Broadcast Messages** (any broadcast, regardless of name)
2. **Target Broadcast List** ("ABCD" if configured)
3. **Target Group** (legacy group support)
4. **1-to-1 Replies** (reply detection)
5. **All other messages are ignored**

## Example .env File

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=./whatsapp-sessions
WHATSAPP_TARGET_BROADCAST_LIST_NAME=ABCD

# Server Configuration
WEBHOOK_PORT=3000
LOG_LEVEL=info
```

## Verification

After setting the environment variable, restart your application. You should see:

```
[INFO] [WhatsApp] Configured target broadcast list { targetBroadcastListName: 'ABCD' }
```

Instead of the old group message.
