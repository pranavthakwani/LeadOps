import { getEnv } from './env.js';

let openaiConfig = null;

export const initOpenAI = () => {
  if (openaiConfig) {
    return openaiConfig;
  }

  const env = getEnv();

  openaiConfig = {
    apiKey: env.openai.apiKey,
    model: env.openai.model,
    maxTokens: env.openai.maxTokens
  };

  return openaiConfig;
};

export const getOpenAIConfig = () => {
  if (!openaiConfig) {
    throw new Error('OpenAI config not initialized. Call initOpenAI() first.');
  }
  return openaiConfig;
};
