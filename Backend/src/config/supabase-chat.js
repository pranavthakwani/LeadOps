import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env.js';

let supabaseInstance = null;

export const initSupabaseChat = () => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const env = getEnv();

  supabaseInstance = createClient(
    env.supabase.url,
    env.supabase.serviceRoleKey,
    {
      auth: {
        persistSession: false
      }
    }
  );

  return supabaseInstance; // Always return the instance
};

export const getSupabaseChat = () => {
  if (!supabaseInstance) {
    throw new Error('Supabase not initialized. Call initSupabaseChat() first.');
  }
  return supabaseInstance;
};
