-- Simple SQL queries to check chat_messages table

-- 1. Check if table exists and get basic stats
SELECT 
    COUNT(*) as total_messages,
    COUNT(DISTINCT jid) as unique_chats,
    MIN(created_at) as earliest_message,
    MAX(created_at) as latest_message
FROM chat_messages;

-- 2. Get recent messages with details
SELECT TOP 10 
    id,
    jid,
    wa_message_id,
    from_me,
    LEFT(message_text, 100) as message_preview,
    message_timestamp,
    created_at,
    status
FROM chat_messages 
ORDER BY created_at DESC;

-- 3. Check messages by JID (chat)
SELECT 
    jid,
    COUNT(*) as message_count,
    MIN(created_at) as first_message,
    MAX(created_at) as last_message
FROM chat_messages 
GROUP BY jid
ORDER BY message_count DESC;

-- 4. Check table structure
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'chat_messages'
ORDER BY ORDINAL_POSITION;
