export const safeJSONParse = (text) => {
  try {
    if (!text || typeof text !== 'string') {
      return null;
    }
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};

export const extractJSONFromText = (text) => {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  return safeJSONParse(match[0]);
};
