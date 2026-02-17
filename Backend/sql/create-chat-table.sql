-- Create chat_messages table for persistent chat storage
CREATE TABLE chat_messages (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    jid NVARCHAR(255) NOT NULL,
    wa_message_id NVARCHAR(255) NOT NULL,
    from_me BIT NOT NULL,
    message_text NVARCHAR(MAX) NULL,
    message_type NVARCHAR(50) DEFAULT 'text',
    message_timestamp BIGINT NOT NULL,
    status INT DEFAULT 0,
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_wa_message UNIQUE (wa_message_id)
);

-- Create index for efficient querying by JID and timestamp
CREATE INDEX IX_chat_jid_timestamp
ON chat_messages (jid, message_timestamp DESC);
