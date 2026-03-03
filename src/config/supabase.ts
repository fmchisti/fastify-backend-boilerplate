import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { logger } from "./logger";

// Client for user operations (uses anon key)
export const supabaseClient: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // We'll handle sessions manually
    },
  }
);

// Admin client for server-side operations (uses service key)
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

logger.info("Supabase clients initialized");
