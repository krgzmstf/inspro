/* ──────────────────────────────────────────────────────────
   insPRO — Supabase tarayıcı istemcisi

   NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY
   .env.local'den okunur (anon key tarayıcıda güvenlidir).
   Anahtar tanımlı değilse uygulama DEMO modunda (localStorage)
   çalışmaya devam eder — supabaseVar() ile kontrol edilir.
   ────────────────────────────────────────────────────────── */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase yapılandırılmış mı? (anahtar var mı) */
export function supabaseVar(): boolean {
  return !!URL && !!ANON;
}

let _client: SupabaseClient | null = null;

/** Tarayıcı tarafı tekil Supabase istemcisi (yoksa null → DEMO modu). */
export function supabase(): SupabaseClient | null {
  if (!supabaseVar()) return null;
  if (!_client) _client = createBrowserClient(URL!, ANON!);
  return _client;
}
