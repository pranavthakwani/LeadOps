/*
  # Add wa_message_id to existing tables
  
  This migration adds WhatsApp message ID tracking to existing tables
  to enable reply tracking functionality.
*/

-- Add wa_message_id to dealer_leads table
ALTER TABLE dealer_leads 
ADD COLUMN IF NOT EXISTS wa_message_id text;

-- Add wa_message_id to distributor_offerings table  
ALTER TABLE distributor_offerings
ADD COLUMN IF NOT EXISTS wa_message_id text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dealer_leads_wa_message_id ON dealer_leads(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_distributor_offerings_wa_message_id ON distributor_offerings(wa_message_id);
