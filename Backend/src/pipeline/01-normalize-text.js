export const normalizeText = (payload) => {
  const analysisText = payload.normalized_text || payload.raw_text || '';

  return {
    ...payload,
    analysis_text: analysisText,
    // Preserve wa_message_id from body to top level for later use
    wa_message_id: payload.body?.wa_message_id || null
  };
};
