/* ──────────────────────────────────────────────────────────
   insPRO — Auth (kendi FastAPI backend'imiz üzerinden)

   E-posta kodlu (OTP) kayıt/giriş + JWT. Token localStorage'da.
   (Eski Supabase auth'un yerini aldı; fonksiyon adları korundu.)
   ────────────────────────────────────────────────────────── */

import { apiGet, apiPost, apiVar, tokenSet, tokenSil, oturumVar } from "@/lib/api";

export interface Kullanici {
  id: string;
  email: string;
  ad_soyad?: string;
  firma?: string;
  rol?: string;
  yetkiler?: string[] | null;
}

export interface AuthSonuc { ok: boolean; mesaj: string; dogrulamaGerek?: boolean }

/** Backend yapılandırılmış mı (API adresi var mı). */
export function supabaseVar(): boolean {
  return apiVar();
}

/** E-postaya 6 haneli kod gönderir (kayıt veya giriş). */
export async function kodGonder(
  email: string, kayit: boolean, adSoyad = "", firma = "",
): Promise<AuthSonuc> {
  try {
    await apiPost("/auth/kod-gonder", { email: email.trim(), kayit, ad_soyad: adSoyad.trim(), firma: firma.trim() });
    return { ok: true, mesaj: "Doğrulama kodu e-postana gönderildi." };
  } catch (e) {
    return { ok: false, mesaj: (e as Error).message };
  }
}

/** Kodu doğrular → token saklanır, oturum açılır. */
export async function kodDogrula(email: string, kod: string): Promise<AuthSonuc> {
  try {
    const r = await apiPost<{ access_token: string; refresh_token?: string; user: Kullanici }>("/auth/kod-dogrula", { email: email.trim(), kod: kod.trim() });
    tokenSet(r.access_token, r.refresh_token);
    return { ok: true, mesaj: "Doğrulandı." };
  } catch (e) {
    return { ok: false, mesaj: (e as Error).message };
  }
}

/** Ortak yerel şifreyle hızlı giriş (kod/e-posta beklemeden). */
export async function ortakGiris(sifre: string): Promise<AuthSonuc> {
  try {
    const r = await apiPost<{ access_token: string; refresh_token?: string; user: Kullanici }>("/auth/yerel-giris", { sifre });
    tokenSet(r.access_token, r.refresh_token);
    return { ok: true, mesaj: "Giriş yapıldı." };
  } catch (e) {
    return { ok: false, mesaj: (e as Error).message };
  }
}

export async function cikisYap(): Promise<void> {
  tokenSil();
}

/** Aktif kullanıcı (token geçerliyse). */
export async function aktifKullanici(): Promise<Kullanici | null> {
  if (!oturumVar()) return null;
  try {
    return await apiGet<Kullanici>("/auth/ben");
  } catch {
    tokenSil();
    return null;
  }
}

/** Oturum durumunu bir kez bildirir (realtime yok). İptal fonksiyonu döner. */
export function oturumDinle(cb: (user: Kullanici | null) => void): () => void {
  aktifKullanici().then(cb);
  return () => {};
}
