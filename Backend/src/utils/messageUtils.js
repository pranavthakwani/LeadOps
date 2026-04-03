// Extract actual text content from WhatsApp message
export function extractText(message) {
  if (!message?.message) return null;

  const msg = message.message;

  // Extract text from various message types
  const text = (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.audioMessage?.caption ||
    null
  );

  // For media messages, return a placeholder if no caption
  if (!text && (msg.imageMessage || msg.videoMessage || msg.documentMessage || msg.audioMessage || msg.stickerMessage)) {
    return '📎 Media'; // Placeholder for media messages without caption
  }

  return text;
}

// Extract media metadata from WhatsApp message
export function extractMediaMetadata(message) {
  if (!message?.message) return null;

  const msg = message.message;
  let mediaData = null;

  // Voice message (WhatsApp voice notes) - handle BEFORE regular audio
  if (msg.audioMessage && msg.audioMessage.ptt) {
    mediaData = {
      type: 'voice',
      url: msg.audioMessage.url,
      filename: `voice_${Date.now()}.ogg`,
      filesize: msg.audioMessage.fileLength,
      mimetype: msg.audioMessage.mimetype,
      duration: msg.audioMessage.seconds
    };
  }
  // Image message
  else if (msg.imageMessage) {
    // Convert thumbnail Uint8Array to base64 string
    let thumbnailBase64 = null;
    if (msg.imageMessage.jpegThumbnail) {
      thumbnailBase64 = Buffer.from(msg.imageMessage.jpegThumbnail).toString('base64');
    }
    
    mediaData = {
      type: 'image',
      url: msg.imageMessage.url,
      filename: msg.imageMessage.fileName || `image_${Date.now()}.jpg`,
      filesize: msg.imageMessage.fileLength,
      mimetype: msg.imageMessage.mimetype,
      width: msg.imageMessage.width,
      height: msg.imageMessage.height,
      caption: msg.imageMessage.caption,
      thumbnail: thumbnailBase64
    };
  }
  // Video message
  else if (msg.videoMessage) {
    // Convert thumbnail Uint8Array to base64 string
    let thumbnailBase64 = null;
    if (msg.videoMessage.jpegThumbnail) {
      thumbnailBase64 = Buffer.from(msg.videoMessage.jpegThumbnail).toString('base64');
    }
    
    mediaData = {
      type: 'video',
      url: msg.videoMessage.url,
      filename: msg.videoMessage.fileName || `video_${Date.now()}.mp4`,
      filesize: msg.videoMessage.fileLength,
      mimetype: msg.videoMessage.mimetype,
      duration: msg.videoMessage.seconds,
      width: msg.videoMessage.width,
      height: msg.videoMessage.height,
      caption: msg.videoMessage.caption,
      thumbnail: thumbnailBase64
    };
  }
  // Audio message (regular audio, not voice)
  else if (msg.audioMessage) {
    mediaData = {
      type: 'audio',
      url: msg.audioMessage.url,
      filename: msg.audioMessage.fileName || `audio_${Date.now()}.mp3`,
      filesize: msg.audioMessage.fileLength,
      mimetype: msg.audioMessage.mimetype,
      duration: msg.audioMessage.seconds,
      caption: msg.audioMessage.caption
    };
  }
  // Document message
  else if (msg.documentMessage) {
    // Convert thumbnail Uint8Array to base64 string
    let thumbnailBase64 = null;
    if (msg.documentMessage.jpegThumbnail) {
      thumbnailBase64 = Buffer.from(msg.documentMessage.jpegThumbnail).toString('base64');
    }
    
    mediaData = {
      type: 'document',
      url: msg.documentMessage.url,
      filename: msg.documentMessage.fileName || `document_${Date.now()}.pdf`,
      filesize: msg.documentMessage.fileLength,
      mimetype: msg.documentMessage.mimetype,
      pageCount: msg.documentMessage.pageCount,
      caption: msg.documentMessage.caption,
      thumbnail: thumbnailBase64
    };
  }
  // Sticker message
  else if (msg.stickerMessage) {
    mediaData = {
      type: 'sticker',
      url: msg.stickerMessage.url,
      filename: `sticker_${Date.now()}.webp`,
      filesize: msg.stickerMessage.fileLength,
      mimetype: msg.stickerMessage.mimetype,
      width: msg.stickerMessage.width,
      height: msg.stickerMessage.height
    };
  }

  return mediaData;
}
