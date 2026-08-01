import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a server-only client for future privileged operations.
 *
 * This client must never be used for user authentication or imported by
 * Client Components.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Supabase admin environment variables are not configured.");
  }

  return createSupabaseClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
