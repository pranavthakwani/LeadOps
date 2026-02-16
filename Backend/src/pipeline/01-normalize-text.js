export const normalizeText = (payload) => {
  const analysisText = payload.normalized_text || payload.raw_text || '';

  return {
    ...payload,
    analysis_text: analysisText
  };
};
