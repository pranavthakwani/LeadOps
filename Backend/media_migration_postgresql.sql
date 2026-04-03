-- Add media support to chat_messages table (PostgreSQL syntax)
-- This migration adds comprehensive media metadata fields to support all WhatsApp media types

-- Add media type field
ALTER TABLE chat_messages 
ADD COLUMN media_type VARCHAR(20) DEFAULT NULL;

-- Add media metadata fields
ALTER TABLE chat_messages 
ADD COLUMN media_url TEXT DEFAULT NULL;

ALTER TABLE chat_messages 
ADD COLUMN media_filename VARCHAR(255) DEFAULT NULL;

ALTER TABLE chat_messages 
ADD COLUMN media_filesize BIGINT DEFAULT NULL;

ALTER TABLE chat_messages 
ADD COLUMN media_mimetype VARCHAR(100) DEFAULT NULL;

ALTER TABLE chat_messages 
ADD COLUMN media_duration INTEGER DEFAULT NULL;

ALTER TABLE chat_messages 
ADD COLUMN media_width INTEGER DEFAULT NULL;

ALTER TABLE chat_messages 
ADD COLUMN media_height INTEGER DEFAULT NULL;

ALTER TABLE chat_messages 
ADD COLUMN media_page_count INTEGER DEFAULT NULL;

ALTER TABLE chat_messages 
ADD COLUMN media_thumbnail_url TEXT DEFAULT NULL;

ALTER TABLE chat_messages 
ADD COLUMN media_caption TEXT DEFAULT NULL;

-- Add column comments separately (PostgreSQL syntax)
COMMENT ON COLUMN chat_messages.media_type IS 'Type of media: image, video, audio, document, sticker, voice';
COMMENT ON COLUMN chat_messages.media_url IS 'Direct URL to media file';
COMMENT ON COLUMN chat_messages.media_filename IS 'Original filename of media';
COMMENT ON COLUMN chat_messages.media_filesize IS 'File size in bytes';
COMMENT ON COLUMN chat_messages.media_mimetype IS 'MIME type of media file';
COMMENT ON COLUMN chat_messages.media_duration IS 'Duration in seconds for audio/video';
COMMENT ON COLUMN chat_messages.media_width IS 'Width in pixels for images/videos';
COMMENT ON COLUMN chat_messages.media_height IS 'Height in pixels for images/videos';
COMMENT ON COLUMN chat_messages.media_page_count IS 'Number of pages for documents';
COMMENT ON COLUMN chat_messages.media_thumbnail_url IS 'URL to thumbnail for images/videos';
COMMENT ON COLUMN chat_messages.media_caption IS 'Caption for media messages';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_media_type ON chat_messages(media_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_media_url ON chat_messages(media_url);

-- Add comment for table
COMMENT ON TABLE chat_messages IS 'Chat messages with comprehensive media support - stores metadata only, actual media files are stored externally';
