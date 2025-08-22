import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

export let initializationError: string | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  initializationError = 'Supabase URL and/or anonymous key are missing. Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set in your environment variables (e.g., in your Netlify dashboard).';
}

// We still create the client to avoid making it nullable everywhere in the app.
// App.tsx will check for the initializationError and prevent the app from running if it exists.
export const supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!);