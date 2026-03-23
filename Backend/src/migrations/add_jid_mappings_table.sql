-- Create jid_mappings table to link @lid and other JIDs to contacts
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'jid_mappings')
BEGIN
    CREATE TABLE jid_mappings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        jid NVARCHAR(255) NOT NULL,
        contact_id INT NOT NULL,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_jid_mappings_jid UNIQUE (jid),
        CONSTRAINT FK_jid_mappings_contact FOREIGN KEY (contact_id) 
            REFERENCES contacts(id) ON DELETE CASCADE
    );
    
    -- Index for faster lookups
    CREATE INDEX IX_jid_mappings_jid ON jid_mappings(jid);
    CREATE INDEX IX_jid_mappings_contact ON jid_mappings(contact_id);
    
    PRINT 'Created jid_mappings table';
END
ELSE
BEGIN
    PRINT 'jid_mappings table already exists';
END
GO

-- Add source_jid column to conversations if not exists
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('conversations') 
               AND name = 'source_jid')
BEGIN
    ALTER TABLE conversations 
    ADD source_jid NVARCHAR(255) NULL;
    
    PRINT 'Added source_jid column to conversations';
END
ELSE
BEGIN
    PRINT 'source_jid column already exists';
END
GO

-- Add is_group_message column to chat_messages if not exists
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('chat_messages') 
               AND name = 'is_group_message')
BEGIN
    ALTER TABLE chat_messages 
    ADD is_group_message BIT DEFAULT 0;
    
    PRINT 'Added is_group_message column to chat_messages';
END
ELSE
BEGIN
    PRINT 'is_group_message column already exists';
END
GO

-- Add original_group_jid column to chat_messages if not exists
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('chat_messages') 
               AND name = 'original_group_jid')
BEGIN
    ALTER TABLE chat_messages 
    ADD original_group_jid NVARCHAR(255) NULL;
    
    PRINT 'Added original_group_jid column to chat_messages';
END
ELSE
BEGIN
    PRINT 'original_group_jid column already exists';
END
GO

-- Migrate existing data: populate source_jid for conversations where it's null
UPDATE conversations 
SET source_jid = jid 
WHERE source_jid IS NULL;

PRINT 'Migration completed successfully';
GO
