import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service role key.
// NEVER import this file from a client component — it bypasses Row Level
// Security and must only run inside API routes / server actions.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    const missing = [
      !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    throw new Error(`Supabase admin client not configured. Missing: ${missing.join(", ")}.`);
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
