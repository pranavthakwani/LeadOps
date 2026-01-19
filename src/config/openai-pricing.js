export const OPENAI_PRICING = {
  "gpt-4o-mini": {
    input: 0.00015 / 1000,
    input_cached: 0.000075 / 1000, // ~50% discount
    output: 0.0006 / 1000
  },
  "gpt-4o": {
    input: 0.005 / 1000,
    input_cached: 0.0025 / 1000, // ~50% discount
    output: 0.015 / 1000
  },
  "gpt-4": {
    input: 0.03 / 1000,
    input_cached: 0.015 / 1000, // ~50% discount
    output: 0.06 / 1000
  },
  "gpt-3.5-turbo": {
    input: 0.0015 / 1000,
    input_cached: 0.00075 / 1000, // ~50% discount
    output: 0.002 / 1000
  }
};
