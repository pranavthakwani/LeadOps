import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env.js';

let supabaseInstance = null;

export const initSupabase = () => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const env = getEnv();

  supabaseInstance = createClient(
    env.supabase.url,
    env.supabase.serviceRoleKey
  );

  return supabaseInstance;
};

export const getSupabase = () => {
  if (!supabaseInstance) {
    throw new Error('Supabase not initialized. Call initSupabase() first.');
  }
  return supabaseInstance;
};
