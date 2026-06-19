/* ──────────────────────────────────────────────────────────
   insPRO — Auth (self-hosted Supabase)

   Kayıt/giriş = Supabase Auth (e-posta + şifre).
   2FA = Google Authenticator (TOTP) — Supabase native MFA.
   Profil bilgileri public.profiles tablosunda tutulur.

   Yerelde e-posta gönderimi kapalı olduğundan kayıt autoconfirm'dir
   (kod adımı atlanır). Üretimde SMTP açılınca kod adımı devreye girer.
   ────────────────────────────────────────────────────────── */

import { supabase, supabaseVar as sbVar } from "./client";

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
export interface KayitSonuc extends AuthSonuc { dogrulandi?: boolean }
export interface GirisSonuc extends AuthSonuc { asama?: "email" | "totp"; tamam?: boolean }

export interface ProfilVeri {
  ad: string; soyad: string; telefon: string; dogum_tarihi: string; meslek: string;
  sirket_mi: boolean; sirket_adi: string; vergi_dairesi: string; vergi_no: string;
}

export function supabaseVar(): boolean { return sbVar(); }

// ── Çevrimdışı oturum önbelleği ──
// getUser() ağ ister; internet yokken kullanıcı panelden atılmasın diye
// son başarılı profil localStorage'da saklanır ve getSession() (ağsız) ile
// birleştirilir.
const PROFIL_CACHE = "inspro-profil-cache";

function profilCacheYaz(k: Kullanici) {
  try { localStorage.setItem(PROFIL_CACHE, JSON.stringify(k)); } catch { /* yok say */ }
}
function profilCacheOku(): Kullanici | null {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(PROFIL_CACHE) : null;
    return s ? (JSON.parse(s) as Kullanici) : null;
  } catch { return null; }
}
function profilCacheSil() {
  try { localStorage.removeItem(PROFIL_CACHE); } catch { /* yok say */ }
}

/** Ağ yokken: yerel oturumdan (getSession ağ istemez) kullanıcıyı kur. */
async function cevrimdisiYedek(c: ReturnType<typeof supabase>): Promise<Kullanici | null> {
  if (!c) return null;
  try {
    const { data: { session } } = await c.auth.getSession();
    if (!session?.user) return null; // gerçekten oturum yok
    const cache = profilCacheOku();
    if (cache && cache.id === session.user.id) return cache;
    // Önbellek yoksa en azından oturum bilgisiyle içeri al
    return {
      id: session.user.id,
      email: session.user.email ?? "",
      rol: "yonetici",
      yetkiler: null,
      profil_tamam: true,
    };
  } catch { return null; }
}

function sb() {
  const c = supabase();
  if (!c) throw new Error("Supabase yapılandırılmadı (.env.local).");
  return c;
}

/** Supabase hata nesnesini Türkçe/okunur mesaja çevir. */
function cevir(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  const map: Record<string, string> = {
    "Invalid login credentials": "E-posta veya şifre hatalı.",
    "User already registered": "Bu e-posta zaten kayıtlı.",
    "Email not confirmed": "E-posta henüz doğrulanmadı.",
    "Token has expired or is invalid": "Kod geçersiz veya süresi dolmuş.",
    "Invalid TOTP code entered": "Authenticator kodu hatalı.",
    "Password should be at least 6 characters": "Şifre en az 6 karakter olmalı.",
  };
  return map[m] ?? m;
}

// ── KAYIT ──
/** 1. adım: e-posta + şifre. Autoconfirm açıksa oturum hemen açılır. */
export async function kayitBasla(email: string, sifre: string): Promise<KayitSonuc> {
  try {
    const { data, error } = await sb().auth.signUp({ email: email.trim(), password: sifre });
    if (error) throw error;
    const dogrulandi = !!data.session; // autoconfirm → oturum var, kod gerekmez
    return {
      ok: true,
      dogrulandi,
      mesaj: dogrulandi ? "" : "Doğrulama kodu e-postana gönderildi.",
    };
  } catch (e) { return { ok: false, mesaj: cevir(e) }; }
}

/** 2. adım (yalnız SMTP açıkken): e-posta kodunu doğrula. */
export async function kayitDogrula(email: string, kod: string): Promise<AuthSonuc> {
  try {
    const { error } = await sb().auth.verifyOtp({ email: email.trim(), token: kod.trim(), type: "signup" });
    if (error) throw error;
    return { ok: true, mesaj: "Doğrulandı." };
  } catch (e) { return { ok: false, mesaj: cevir(e) }; }
}

/** 3. adım: profil bilgilerini kaydet (profiles tablosu). */
export async function profilTamamla(v: ProfilVeri): Promise<AuthSonuc> {
  try {
    const c = sb();
    const { data: { user } } = await c.auth.getUser();
    if (!user) throw new Error("Oturum bulunamadı.");
    const ad_soyad = `${v.ad} ${v.soyad}`.trim();
    const { error } = await c.from("profiles").update({
      ad: v.ad, soyad: v.soyad, ad_soyad,
      telefon: v.telefon || null,
      dogum_tarihi: v.dogum_tarihi || null,
      meslek: v.meslek || null,
      sirket_mi: v.sirket_mi,
      sirket_adi: v.sirket_adi || null,
      vergi_dairesi: v.vergi_dairesi || null,
      vergi_no: v.vergi_no || null,
      firma: v.sirket_mi ? (v.sirket_adi || null) : null,
      profil_tamam: true,
    }).eq("id", user.id);
    if (error) throw error;
    return { ok: true, mesaj: "Profil kaydedildi." };
  } catch (e) { return { ok: false, mesaj: cevir(e) }; }
}

// ── GİRİŞ (şifre + opsiyonel TOTP 2FA) ──
/** 1. adım: e-posta + şifre. MFA varsa asama:"totp", yoksa tamam:true. */
export async function girisBasla(email: string, sifre: string): Promise<GirisSonuc> {
  try {
    const c = sb();
    const { error } = await c.auth.signInWithPassword({ email: email.trim(), password: sifre });
    if (error) throw error;
    const { data: aal } = await c.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      return { ok: true, mesaj: "", asama: "totp" };
    }
    return { ok: true, mesaj: "", tamam: true };
  } catch (e) { return { ok: false, mesaj: cevir(e) }; }
}

/** 2. adım: Google Authenticator kodu ile MFA doğrulaması. */
export async function girisDogrula(_email: string, kod: string): Promise<AuthSonuc> {
  try {
    const c = sb();
    const { data: factors } = await c.auth.mfa.listFactors();
    const totp = factors?.totp?.[0];
    if (!totp) throw new Error("Authenticator faktörü bulunamadı.");
    const { data: ch, error: e1 } = await c.auth.mfa.challenge({ factorId: totp.id });
    if (e1) throw e1;
    const { error: e2 } = await c.auth.mfa.verify({ factorId: totp.id, challengeId: ch.id, code: kod.trim() });
    if (e2) throw e2;
    return { ok: true, mesaj: "Giriş yapıldı." };
  } catch (e) { return { ok: false, mesaj: cevir(e) }; }
}

// ── Google Authenticator (TOTP) ──
export async function totpKur(): Promise<{ secret: string; otpauth: string; qr: string }> {
  const c = sb();
  // Yarım kalmış (unverified) faktörleri temizle
  try {
    const { data: f } = await c.auth.mfa.listFactors();
    for (const fac of (f?.all ?? [])) {
      if (fac.status === "unverified") await c.auth.mfa.unenroll({ factorId: fac.id });
    }
  } catch { /* yok say */ }
  const { data, error } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "insPRO-" + Date.now() });
  if (error) throw error;
  // qr_code: Supabase'in sunucuda ürettiği SVG QR (data URI) — harici servise secret gitmez
  return { secret: data.totp.secret, otpauth: data.totp.uri, qr: data.totp.qr_code };
}

export async function totpAktif(kod: string): Promise<AuthSonuc> {
  try {
    const c = sb();
    const { data: f } = await c.auth.mfa.listFactors();
    const fac = f?.all?.find((x) => x.status === "unverified") ?? f?.totp?.[0];
    if (!fac) throw new Error("Önce kurulumu başlatın.");
    const { data: ch, error: e1 } = await c.auth.mfa.challenge({ factorId: fac.id });
    if (e1) throw e1;
    const { error: e2 } = await c.auth.mfa.verify({ factorId: fac.id, challengeId: ch.id, code: kod.trim() });
    if (e2) throw e2;
    return { ok: true, mesaj: "Google Authenticator aktif." };
  } catch (e) { return { ok: false, mesaj: cevir(e) }; }
}

export async function totpKapat(): Promise<AuthSonuc> {
  try {
    const c = sb();
    const { data: f } = await c.auth.mfa.listFactors();
    for (const fac of (f?.totp ?? [])) await c.auth.mfa.unenroll({ factorId: fac.id });
    return { ok: true, mesaj: "İki adımlı doğrulama kapatıldı." };
  } catch (e) { return { ok: false, mesaj: cevir(e) }; }
}

// ── Ortak yerel hızlı giriş (kayıtsız DEMO kapısı) ──
const ORTAK_SIFRE = "Yaze.12345";
export async function ortakGiris(sifre: string): Promise<AuthSonuc> {
  if (sifre !== ORTAK_SIFRE) return { ok: false, mesaj: "Ortak şifre hatalı." };
  try {
    const { yerelGiris } = await import("@/lib/yerelOturum");
    yerelGiris("Yerel Kullanıcı");
    return { ok: true, mesaj: "Giriş yapıldı." };
  } catch (e) { return { ok: false, mesaj: (e as Error).message }; }
}

// ── Google ile giriş (OAuth) ──
export async function googleGiris(): Promise<AuthSonuc> {
  try {
    const c = sb();
    const { error } = await c.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? `${window.location.origin}/panel` : undefined },
    });
    if (error) throw error;
    return { ok: true, mesaj: "" };
  } catch (e) { return { ok: false, mesaj: cevir(e) }; }
}

// ── Şifremi unuttum (e-posta ile sıfırlama bağlantısı) ──
export async function sifremiUnuttum(email: string): Promise<AuthSonuc> {
  try {
    const c = sb();
    const { error } = await c.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/sifre-sifirla` : undefined,
    });
    if (error) throw error;
    return { ok: true, mesaj: "Şifre sıfırlama bağlantısı e-postana gönderildi." };
  } catch (e) { return { ok: false, mesaj: cevir(e) }; }
}

// ── Yeni şifre belirle (sıfırlama sayfasında) ──
export async function sifreyiGuncelle(yeniSifre: string): Promise<AuthSonuc> {
  try {
    const c = sb();
    const { error } = await c.auth.updateUser({ password: yeniSifre });
    if (error) throw error;
    return { ok: true, mesaj: "Şifren güncellendi." };
  } catch (e) { return { ok: false, mesaj: cevir(e) }; }
}

// ── Şifre değiştir (Ayarlar — mevcut şifre doğrulamalı) ──
export async function sifreDegistir(mevcut: string, yeni: string): Promise<AuthSonuc> {
  try {
    const c = sb();
    const { data: { user } } = await c.auth.getUser();
    if (!user?.email) return { ok: false, mesaj: "Oturum bulunamadı." };
    if (yeni.length < 6) return { ok: false, mesaj: "Yeni şifre en az 6 karakter olmalı." };
    // Mevcut şifreyi doğrula (yanlışsa güncelleme yapma)
    const { error: e1 } = await c.auth.signInWithPassword({ email: user.email, password: mevcut });
    if (e1) return { ok: false, mesaj: "Mevcut şifre hatalı." };
    const { error: e2 } = await c.auth.updateUser({ password: yeni });
    if (e2) throw e2;
    return { ok: true, mesaj: "Şifren başarıyla güncellendi." };
  } catch (e) { return { ok: false, mesaj: cevir(e) }; }
}

export async function cikisYap(): Promise<void> {
  profilCacheSil();
  try { await sb().auth.signOut(); } catch { /* yok say */ }
}

export async function aktifKullanici(): Promise<Kullanici | null> {
  if (!supabaseVar()) return null;
  const c = supabase();
  if (!c) return null;
  try {
    const { data: { user } } = await c.auth.getUser();
    if (!user) {
      // getUser ağ ister; user=null ise (online) gerçekten oturum yok.
      // Yine de bir oturum kalıntısı varsa çevrimdışı yedeğe bak.
      const yedek = await cevrimdisiYedek(c);
      if (!yedek) profilCacheSil();
      return yedek;
    }
    const { data: p } = await c.from("profiles").select("*").eq("id", user.id).maybeSingle();
    let yontem: "email" | "totp" = "email";
    try {
      const { data: f } = await c.auth.mfa.listFactors();
      if ((f?.totp?.length ?? 0) > 0) yontem = "totp";
    } catch { /* yok say */ }
    const k: Kullanici = {
      id: user.id,
      email: user.email ?? "",
      ad_soyad: p?.ad_soyad ?? undefined,
      firma: p?.firma ?? undefined,
      rol: p?.rol ?? "yonetici",
      yetkiler: Array.isArray(p?.yetkiler) ? p.yetkiler : null,
      ad: p?.ad ?? undefined,
      soyad: p?.soyad ?? undefined,
      telefon: p?.telefon ?? undefined,
      dogum_tarihi: p?.dogum_tarihi ?? undefined,
      meslek: p?.meslek ?? undefined,
      sirket_mi: p?.sirket_mi ?? undefined,
      sirket_adi: p?.sirket_adi ?? undefined,
      vergi_dairesi: p?.vergi_dairesi ?? undefined,
      vergi_no: p?.vergi_no ?? undefined,
      profil_tamam: p?.profil_tamam ?? false,
      iki_adim_yontem: yontem,
    };
    profilCacheYaz(k); // çevrimdışı giriş için sakla
    return k;
  } catch {
    // Ağ hatası (offline) → yerel oturum + önbellekten gir
    return cevrimdisiYedek(c);
  }
}

/** Oturum değişimini dinle (giriş/çıkış). */
export function oturumDinle(cb: (user: Kullanici | null) => void): () => void {
  const c = supabase();
  if (!c) { cb(null); return () => {}; }
  const { data } = c.auth.onAuthStateChange(() => { aktifKullanici().then(cb); });
  return () => { data.subscription.unsubscribe(); };
}
