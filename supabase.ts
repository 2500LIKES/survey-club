import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xsjusojjwpzhbfsbmkax.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_LC69PMvBvzkF6n6sMRFzEg_TIjTtkUZ";

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});