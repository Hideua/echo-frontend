import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Возвращает клиент Supabase, создавая его ТОЛЬКО в браузере. */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  if (typeof window === "undefined") {
    // Во время сборки/пререндеринга клиент не инициализируем.
    throw new Error("Supabase client is browser-only");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase env");

  client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
