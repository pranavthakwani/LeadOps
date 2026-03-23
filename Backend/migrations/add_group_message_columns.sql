-- Add missing columns to chat_messages table for group message support
ALTER TABLE chat_messages 
ADD is_group_message BIT DEFAULT 0;

ALTER TABLE chat_messages 
ADD original_group_jid NVARCHAR(255) NULL;
