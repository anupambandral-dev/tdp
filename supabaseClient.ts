import { createClient } from '@supabase/supabase-js';

// Use import.meta.env for Vite environments to access environment variables
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anonymous key are required. Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set in your environment.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);