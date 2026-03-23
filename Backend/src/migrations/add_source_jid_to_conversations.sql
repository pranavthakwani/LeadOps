-- Add source_jid column to conversations table
-- This will store the original JID (group/broadcast) when the real JID is extracted

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'conversations' AND COLUMN_NAME = 'source_jid')
BEGIN
    ALTER TABLE conversations 
    ADD source_jid NVARCHAR(255) NULL;
    
    PRINT 'Added source_jid column to conversations table';
END
ELSE
BEGIN
    PRINT 'source_jid column already exists in conversations table';
END;

-- Create index for faster queries (only if column exists and index doesn't exist)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 'conversations' AND COLUMN_NAME = 'source_jid')
AND NOT EXISTS (SELECT * FROM sys.indexes 
                WHERE name = 'idx_conversations_source_jid' AND object_id = OBJECT_ID('conversations'))
BEGIN
    CREATE INDEX idx_conversations_source_jid ON conversations(source_jid);
    PRINT 'Created index on source_jid column';
END;

-- Add comment explaining the purpose (SQL Server extended property)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 'conversations' AND COLUMN_NAME = 'source_jid')
BEGIN
    EXEC sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'Original JID (@g.us, @broadcast) for broadcast/group messages. Real participant JID is stored in jid column.', 
        @level0type = N'SCHEMA', @level0name = N'dbo', 
        @level1type = N'TABLE', @level1name = N'conversations', 
        @level2type = N'COLUMN', @level2name = N'source_jid';
    PRINT 'Added extended property to source_jid column';
END;
