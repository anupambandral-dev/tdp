import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anonymous key are required. Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set in your environment.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);