import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for Client Components.
 *
 * Never place a Supabase secret key in this file because browser code
 * can be inspected by users.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase browser environment variables are not configured.",
    );
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}