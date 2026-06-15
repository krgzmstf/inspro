/* ──────────────────────────────────────────────────────────
   insPRO — Supabase Auth yardımcıları (istemci tarafı)

   Oturum supabase-js tarafından localStorage'da tutulur; sayfa
   yenilense de korunur. Anahtar yoksa (DEMO) fonksiyonlar nazikçe
   hata döndürür.
   ────────────────────────────────────────────────────────── */

import { supabase, supabaseVar } from "./client";
import type { User } from "@supabase/supabase-js";

export { supabaseVar };

export interface AuthSonuc { ok: boolean; mesaj: string; dogrulamaGerek?: boolean }

export async function kayitOl(
  email: string, sifre: string, adSoyad: string, firma: string,
): Promise<AuthSonuc> {
  const sb = supabase();
  if (!sb) return { ok: false, mesaj: "Supabase yapılandırılmamış." };
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password: sifre,
    options: { data: { ad_soyad: adSoyad.trim(), firma: firma.trim() } },
  });
  if (error) return { ok: false, mesaj: cevir(error.message) };
  // E-posta doğrulama açıksa oturum hemen gelmez
  if (!data.session) return { ok: true, mesaj: "Kayıt alındı. E-postana gelen doğrulama bağlantısına tıkla.", dogrulamaGerek: true };
  return { ok: true, mesaj: "Hesap oluşturuldu." };
}

export async function girisYap(email: string, sifre: string): Promise<AuthSonuc> {
  const sb = supabase();
  if (!sb) return { ok: false, mesaj: "Supabase yapılandırılmamış." };
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: sifre });
  if (error) return { ok: false, mesaj: cevir(error.message) };
  return { ok: true, mesaj: "Giriş yapıldı." };
}

export async function cikisYap(): Promise<void> {
  await supabase()?.auth.signOut();
}

export async function aktifKullanici(): Promise<User | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

/** Oturum değişimini dinler (giriş/çıkış). Aboneliği iptal eden fonksiyon döner. */
export function oturumDinle(cb: (user: User | null) => void): () => void {
  const sb = supabase();
  if (!sb) { cb(null); return () => {}; }
  const { data } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

/** Sık Supabase hatalarını Türkçeleştirir. */
function cevir(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-posta veya şifre hatalı.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Bu e-posta zaten kayıtlı.";
  if (m.includes("password should be at least")) return "Şifre en az 6 karakter olmalı.";
  if (m.includes("email not confirmed")) return "E-posta henüz doğrulanmamış; gelen kutunu kontrol et.";
  if (m.includes("unable to validate email")) return "Geçerli bir e-posta gir.";
  return msg;
}
