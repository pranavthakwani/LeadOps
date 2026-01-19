/*
  # Create distributor_offerings table

  1. New Tables
    - `distributor_offerings` - Stores classified distributor offering messages
      - Same schema as dealer_leads table
      - Stores messages from distributors/sellers offering stock
*/

CREATE TABLE IF NOT EXISTS distributor_offerings (
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
