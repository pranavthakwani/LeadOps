/*
  # Create message_replies table

  1. New Tables
    - `message_replies` - Tracks replies to broadcast messages
      - `id` (uuid, primary key)
      - `original_table` (text) - 'dealer_leads' or 'distributor_offerings'
      - `original_row_id` (uuid) - id of the row in dealer_leads / distributor_offerings
      - `original_wa_message_id` (text) - WhatsApp message ID of the original broadcast message
      - `reply_wa_message_id` (text) - WhatsApp message ID of the reply
      - `contact_number` (text) - WhatsApp number of the person who replied
      - `contact_name` (text, nullable) - Contact name from WhatsApp
      - `reply_text` (text) - Content of the reply message
      - `created_at` (timestamp, default now()) - When the reply was received
*/

CREATE TABLE IF NOT EXISTS message_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_table text NOT NULL CHECK (original_table IN ('dealer_leads', 'distributor_offerings')),
  original_row_id uuid NOT NULL,
  original_wa_message_id text NOT NULL,
  reply_wa_message_id text NOT NULL UNIQUE,
  contact_number text NOT NULL,
  contact_name text,
  reply_text text NOT NULL,
  created_at timestamp DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_replies_original_wa_message_id ON message_replies(original_wa_message_id);
CREATE INDEX IF NOT EXISTS idx_message_replies_original_table_row_id ON message_replies(original_table, original_row_id);
CREATE INDEX IF NOT EXISTS idx_message_replies_contact_number ON message_replies(contact_number);
