import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
// Use service_role key for backend operations (bypasses RLS)
// Backend handles its own authorization via Express middleware
const supabaseKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '').trim();

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key is missing. Storage operations may fail.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'submissions';
