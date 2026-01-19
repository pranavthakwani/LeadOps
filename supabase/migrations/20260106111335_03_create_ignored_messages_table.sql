/*
  # Create ignored_messages table

  1. New Tables
    - `ignored_messages` - Stores non-business or noise messages
      - `id` (uuid, primary key)
      - `sender` (text) - WhatsApp sender identifier
      - `chat_id` (text) - WhatsApp chat identifier
      - `chat_type` (text) - Type of chat (individual/group)
      - `confidence` (numeric) - Classification confidence score
      - `raw_message` (text) - Original message text
      - `created_at` (timestamp) - Record creation time
*/

CREATE TABLE IF NOT EXISTS ignored_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender text,
  chat_id text,
  chat_type text,
  confidence numeric,
  raw_message text,
  created_at timestamp DEFAULT now()
);
