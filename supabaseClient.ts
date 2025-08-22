import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

export let initializationError: string | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  initializationError = 'Supabase URL and/or anonymous key are missing. Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set in your environment variables (e.g., in your Netlify dashboard).';
}

// Pass empty strings if the vars are missing to prevent a hard crash.
// The App component will check for initializationError and show a user-friendly message.
export const supabase = createClient<Database>(supabaseUrl || '', supabaseAnonKey || '');