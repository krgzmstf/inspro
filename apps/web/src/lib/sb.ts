/* ──────────────────────────────────────────────────────────
   insPRO — Supabase veri yardımcıları (tam-Supabase)

   Tüm modüller (projeler, muhasebe, metraj, saha…) kullanıcı
   başına tek satırda JSONB dizi olarak `modul_veri` tablosunda
   tutulur. Bu, localStorage dizileriyle birebir eşleşir ve
   alan-adı (camelCase ↔ snake_case) çakışmalarını ortadan kaldırır.

   Oturum yoksa tüm işlemler sessizce no-op → uygulama localStorage
   ile (DEMO modu) çalışmaya devam eder.
   ────────────────────────────────────────────────────────── */

import { supabase, supabaseVar } from "./supabase/client";

/** Aktif kullanıcının id'si (oturum yoksa null). */
export async function aktifKullaniciId(): Promise<string | null> {
  if (!supabaseVar()) return null;
  const c = supabase();
  if (!c) return null;
  try {
    const { data } = await c.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Bir modülün buluttaki JSONB dizisini oku. Oturum yoksa null. */
export async function blobOku<T = unknown>(modul: string): Promise<T[] | null> {
  const c = supabase();
  if (!c) return null;
  const uid = await aktifKullaniciId();
  if (!uid) return null;
  try {
    const { data, error } = await c
      .from("modul_veri")
      .select("veri")
      .eq("owner_id", uid)
      .eq("modul", modul)
      .maybeSingle();
    if (error) throw error;
    const v = data?.veri;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return null;
  }
}

/** Bir modülün tüm dizisini buluta yaz (upsert). Oturum yoksa no-op. */
export async function blobYaz(modul: string, dizi: unknown[]): Promise<void> {
  const c = supabase();
  if (!c) return;
  const uid = await aktifKullaniciId();
  if (!uid) return;
  try {
    await c
      .from("modul_veri")
      .upsert(
        { owner_id: uid, modul, veri: dizi, updated_at: new Date().toISOString() },
        { onConflict: "owner_id,modul" },
      );
  } catch {
    /* sessiz */
  }
}
