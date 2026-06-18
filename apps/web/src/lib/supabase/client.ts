/* ──────────────────────────────────────────────────────────
   insPRO — Supabase tarayıcı istemcisi

   NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY
   .env.local'den okunur (anon key tarayıcıda güvenlidir).
   Anahtar tanımlı değilse uygulama DEMO modunda (localStorage)
   çalışmaya devam eder — supabaseVar() ile kontrol edilir.
   ────────────────────────────────────────────────────────── */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Üretim varsayılanları (HERKESE AÇIK değerler — anon key tarayıcıda zaten görünür,
// gizli değildir). Vercel ortam değişkeni eksik/bozuk olsa bile bunlar kullanılır.
const URETIM_URL = "https://api-inspro.yazeproje.com";
const URETIM_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxNzIzMTYzLCJleHAiOjE5Mzk0MDMxNjN9.2PQm7klk3t-_s_yUWufITguCn0x1s_COLs3LgB9NRdM";

// Ortam değişkeni geçerliyse onu kullan (yerelde localhost), yoksa/bozuksa üretim varsayılanı.
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const URL = envUrl && envUrl.startsWith("http") ? envUrl : URETIM_URL;
const ANON = envAnon && envAnon.length > 100 ? envAnon : URETIM_ANON;

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
