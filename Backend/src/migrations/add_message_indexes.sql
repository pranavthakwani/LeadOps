-- Add indexes to optimize message queries
-- These indexes will help speed up the getMessages query

-- Check and create index on created_at for dealer_leads
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('dealer_leads') AND name = 'idx_dealer_leads_created_at')
BEGIN
    CREATE INDEX idx_dealer_leads_created_at ON dealer_leads(created_at DESC);
END

-- Check and create index on created_at for distributor_offerings
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('distributor_offerings') AND name = 'idx_distributor_offerings_created_at')
BEGIN
    CREATE INDEX idx_distributor_offerings_created_at ON distributor_offerings(created_at DESC);
END

-- Check and create index on created_at for ignored_messages
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('ignored_messages') AND name = 'idx_ignored_messages_created_at')
BEGIN
    CREATE INDEX idx_ignored_messages_created_at ON ignored_messages(created_at DESC);
END

-- Check and create general index on jid in jid_mappings
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('jid_mappings') AND name = 'idx_jid_mappings_jid')
BEGIN
    CREATE INDEX idx_jid_mappings_jid ON jid_mappings(jid);
END
