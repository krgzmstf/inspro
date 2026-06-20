/* ──────────────────────────────────────────────────────────
   insPRO — Sunucu tarafı Supabase admin istemcisi (SADECE API route)

   service_role anahtarıyla tüm verilere erişir; ASLA tarayıcıya
   gönderilmez. Her istekte çağıranın access token'ı doğrulanır ve
   yönetici rolü kontrol edilir.
   ────────────────────────────────────────────────────────── */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Üretim varsayılanı (herkese açık URL — gizli değil). Vercel ortam değişkeni
// eksik/bozuk olsa bile sunucu doğru Supabase örneğine bağlanır.
const URETIM_URL = "https://api-inspro.yazeproje.com";

// Ortam değişkenine yapıştırırken boşluk/satır sonu karışabiliyor; Kong böyle bir
// apikey'i reddeder → getUser "Geçersiz oturum" döner. client.ts gibi temizle.
const temiz = (s?: string) => (s ?? "").replace(/\s+/g, "");
const envUrl = temiz(process.env.NEXT_PUBLIC_SUPABASE_URL);
const URL = envUrl.startsWith("http") ? envUrl : URETIM_URL;
const SERVICE = temiz(process.env.SUPABASE_SERVICE_ROLE_KEY);

export function adminClient(): SupabaseClient {
  return createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function yanit(detail: string, status: number): Response {
  return new Response(JSON.stringify({ detail }), {
    status, headers: { "Content-Type": "application/json" },
  });
}

export type Dogrulama =
  | { ok: true; sb: SupabaseClient; uid: string }
  | { ok: false; resp: Response };

/**
 * Authorization: Bearer <access_token> → kullanıcıyı doğrula + SÜPER ADMIN mi kontrol et.
 * Not: Her üye rol=yonetici (kendi verisinin yöneticisi). Platform yönetim merkezine
 * yalnızca gizli süper adminler (profiles.gizli=true) erişebilir.
 */
export async function adminDogrula(req: Request): Promise<Dogrulama> {
  if (!URL || !SERVICE) return { ok: false, resp: yanit("Supabase sunucu anahtarı tanımsız.", 500) };
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, resp: yanit("Oturum gerekli.", 401) };
  const sb = adminClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return { ok: false, resp: yanit("Geçersiz oturum.", 401) };
  const { data: p } = await sb.from("profiles").select("gizli").eq("id", data.user.id).maybeSingle();
  if (!p?.gizli) return { ok: false, resp: yanit("Yalnızca süper admin erişebilir.", 403) };
  return { ok: true, sb, uid: data.user.id };
}

/** Eski/serbest rol adlarını 4 role indirger. */
export function rolNormalize(r: string | null | undefined): string {
  if (r === "yonetici" || r === "sefi" || r === "taseron" || r === "muhasebeci") return r;
  if (r === "sahip" || r === "ofis") return "yonetici";
  if (r === "usta") return "taseron";
  return "yonetici";
}
