// Extract actual text content from WhatsApp message
export function extractText(message) {
  if (!message?.message) return null;

  const msg = message.message;

  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    null
  );
}
