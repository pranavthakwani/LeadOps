import { getEnv } from '../config/env.js';

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

export const createLogger = (module) => {
  const env = getEnv();
  const currentLevel = LOG_LEVELS[env.logging.level] ?? 1;

  return {
    debug: (message, data = {}) => {
      if (LOG_LEVELS.debug >= currentLevel) {
        console.log(`[DEBUG] [${module}]`, message, data);
      }
    },
    info: (message, data = {}) => {
      if (LOG_LEVELS.info >= currentLevel) {
        console.log(`[INFO] [${module}]`, message, data);
      }
    },
    warn: (message, data = {}) => {
      if (LOG_LEVELS.warn >= currentLevel) {
        console.warn(`[WARN] [${module}]`, message, data);
      }
    },
    error: (message, error = {}) => {
      if (LOG_LEVELS.error >= currentLevel) {
        console.error(`[ERROR] [${module}]`, message, error instanceof Error ? error.message : error);
      }
    }
  };
};
