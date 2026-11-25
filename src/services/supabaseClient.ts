import { createClient } from '@supabase/supabase-js';


const env = import.meta.env;
const url = String(env.VITE_SUPABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');
const anonKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/^=+/, '').replace(/^['"]|['"]$/g, '');

export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes('your-project') && !anonKey.includes('replace-me')
);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'healthpass-supabase-auth',
      },
      db: { schema: 'public' },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then restart Vite.');
  }
  return supabase;
}
