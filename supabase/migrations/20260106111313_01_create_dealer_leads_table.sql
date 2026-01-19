/*
  # Create dealer_leads table

  1. New Tables
    - `dealer_leads` - Stores classified dealer lead messages
      - `id` (uuid, primary key)
      - `sender` (text) - WhatsApp sender identifier
      - `chat_id` (text) - WhatsApp chat identifier
      - `chat_type` (text) - Type of chat (individual/group)
      - `brand` (text) - Phone brand/manufacturer
      - `model` (text) - Phone model name
      - `variant` (text) - Phone variant/version
      - `ram` (integer) - RAM in GB
      - `storage` (integer) - Storage in GB
      - `colors` (jsonb) - Color availability as JSON object
      - `quantity` (integer) - Single quantity value
      - `quantity_min` (integer) - Minimum quantity in range
      - `quantity_max` (integer) - Maximum quantity in range
      - `price` (numeric) - Single price value
      - `price_min` (numeric) - Minimum price in range
      - `price_max` (numeric) - Maximum price in range
      - `condition` (text) - Phone condition (fresh/used)
      - `gst` (boolean) - Whether GST is applicable
      - `dispatch` (text) - Dispatch timeline
      - `confidence` (numeric) - Classification confidence score
      - `raw_message` (text) - Original message text
      - `created_at` (timestamp) - Record creation time
*/

CREATE TABLE IF NOT EXISTS dealer_leads (
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
  created_at timestamp DEFAULT now()
);
