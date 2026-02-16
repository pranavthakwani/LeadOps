import { getEnv } from './env.js';

let whatsappConfig = null;

export const initWhatsAppConfig = () => {
  if (whatsappConfig) {
    return whatsappConfig;
  }

  const env = getEnv();

  whatsappConfig = {
    sessionPath: env.whatsapp.sessionPath,
    targetBusinessName: env.whatsapp.targetBusinessName,
    targetGroupName: env.whatsapp.targetGroupName || null,
    targetBroadcastListName: env.whatsapp.targetBroadcastListName || null
  };

  return whatsappConfig;
};

export const getWhatsAppConfig = () => {
  if (!whatsappConfig) {
    throw new Error('WhatsApp config not initialized. Call initWhatsAppConfig() first.');
  }
  return whatsappConfig;
};
