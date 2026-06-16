/* ──────────────────────────────────────────────────────────
   insPRO — Auth (kendi FastAPI backend'imiz)

   Parola + 2 adımlı doğrulama (e-posta kodu veya Google Authenticator).
   Token localStorage'da. (Eski Supabase auth'un yerini aldı.)
   ────────────────────────────────────────────────────────── */

import { apiGet, apiPost, apiVar, tokenSet, tokenSil, oturumVar } from "@/lib/api";

export interface Kullanici {
  id: string;
  email: string;
  ad_soyad?: string;
  firma?: string;
  rol?: string;
  yetkiler?: string[] | null;
  ad?: string;
  soyad?: string;
  telefon?: string;
  dogum_tarihi?: string;
  meslek?: string;
  sirket_mi?: boolean;
  sirket_adi?: string;
  vergi_dairesi?: string;
  vergi_no?: string;
  profil_tamam?: boolean;
  iki_adim_yontem?: "email" | "totp";
}

export interface AuthSonuc { ok: boolean; mesaj: string }
export interface GirisSonuc extends AuthSonuc { asama?: "email" | "totp" }

export interface ProfilVeri {
  ad: string; soyad: string; telefon: string; dogum_tarihi: string; meslek: string;
  sirket_mi: boolean; sirket_adi: string; vergi_dairesi: string; vergi_no: string;
}

export function supabaseVar(): boolean { return apiVar(); }

// ── KAYIT ──
/** 1. adım: e-posta + şifre → e-postaya kod gönderilir. */
export async function kayitBasla(email: string, sifre: string): Promise<AuthSonuc> {
  try {
    await apiPost("/auth/kayit-basla", { email: email.trim(), sifre });
    return { ok: true, mesaj: "Doğrulama kodu e-postana gönderildi." };
  } catch (e) { return { ok: false, mesaj: (e as Error).message }; }
}

/** 2. adım: kodu doğrula → oturum açılır (profil eksik kalır). */
export async function kayitDogrula(email: string, kod: string): Promise<AuthSonuc> {
  try {
    const r = await apiPost<{ access_token: string; refresh_token?: string }>("/auth/kayit-dogrula", { email: email.trim(), kod: kod.trim() });
    tokenSet(r.access_token, r.refresh_token);
    return { ok: true, mesaj: "Doğrulandı." };
  } catch (e) { return { ok: false, mesaj: (e as Error).message }; }
}

/** 3. adım: profil bilgilerini kaydet. */
export async function profilTamamla(v: ProfilVeri): Promise<AuthSonuc> {
  try {
    await apiPost("/auth/profil-tamamla", v);
    return { ok: true, mesaj: "Profil kaydedildi." };
  } catch (e) { return { ok: false, mesaj: (e as Error).message }; }
}

// ── GİRİŞ (2FA) ──
/** 1. adım: e-posta + şifre → ikinci adım yöntemi döner (email kodu / totp). */
export async function girisBasla(email: string, sifre: string): Promise<GirisSonuc> {
  try {
    const r = await apiPost<{ asama: "email" | "totp" }>("/auth/giris", { email: email.trim(), sifre });
    return { ok: true, mesaj: "", asama: r.asama };
  } catch (e) { return { ok: false, mesaj: (e as Error).message }; }
}

/** 2. adım: e-posta kodu VEYA Authenticator kodu → oturum açılır. */
export async function girisDogrula(email: string, kod: string): Promise<AuthSonuc> {
  try {
    const r = await apiPost<{ access_token: string; refresh_token?: string }>("/auth/giris-dogrula", { email: email.trim(), kod: kod.trim() });
    tokenSet(r.access_token, r.refresh_token);
    return { ok: true, mesaj: "Giriş yapıldı." };
  } catch (e) { return { ok: false, mesaj: (e as Error).message }; }
}

// ── Google Authenticator (TOTP) ──
export async function totpKur(): Promise<{ secret: string; otpauth: string }> {
  return apiPost<{ secret: string; otpauth: string }>("/auth/totp/kur");
}
export async function totpAktif(kod: string): Promise<AuthSonuc> {
  try { await apiPost("/auth/totp/aktif", { kod: kod.trim() }); return { ok: true, mesaj: "Google Authenticator aktif." }; }
  catch (e) { return { ok: false, mesaj: (e as Error).message }; }
}
export async function totpKapat(): Promise<AuthSonuc> {
  try { await apiPost("/auth/totp/kapat"); return { ok: true, mesaj: "E-posta koduna dönüldü." }; }
  catch (e) { return { ok: false, mesaj: (e as Error).message }; }
}

// ── Ortak yerel hızlı giriş ──
export async function ortakGiris(sifre: string): Promise<AuthSonuc> {
  try {
    const r = await apiPost<{ access_token: string; refresh_token?: string }>("/auth/yerel-giris", { sifre });
    tokenSet(r.access_token, r.refresh_token);
    return { ok: true, mesaj: "Giriş yapıldı." };
  } catch (e) { return { ok: false, mesaj: (e as Error).message }; }
}

export async function cikisYap(): Promise<void> { tokenSil(); }

export async function aktifKullanici(): Promise<Kullanici | null> {
  if (!oturumVar()) return null;
  try { return await apiGet<Kullanici>("/auth/ben"); }
  catch { tokenSil(); return null; }
}

export function oturumDinle(cb: (user: Kullanici | null) => void): () => void {
  aktifKullanici().then(cb);
  return () => {};
}
