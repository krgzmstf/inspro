/* ──────────────────────────────────────────────────────────
   insPRO — Yönetim paneli istemcisi (Next.js API route'larına)

   Tüm admin işlemleri sunucu tarafındaki /api/yonetim/* route'larına
   gider; oturum access token'ı Authorization başlığıyla taşınır.
   service_role anahtarı yalnız sunucuda kullanılır.
   ────────────────────────────────────────────────────────── */

import { supabase } from "./supabase/client";
import { apiFetch } from "./apiTaban";

async function basliklar(): Promise<HeadersInit> {
  const c = supabase();
  const { data } = c ? await c.auth.getSession() : { data: { session: null } };
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + (data.session?.access_token ?? ""),
  };
}

async function iste<T = unknown>(yol: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch("/api/yonetim" + yol, { ...init, headers: { ...(await basliklar()), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    let mesaj = "İşlem başarısız.";
    try { const j = await res.json(); mesaj = (j.detail ?? mesaj) as string; } catch { /* gövde yok */ }
    throw new Error(mesaj);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export interface YonetimKullanici {
  id: string; email: string; ad_soyad: string; firma: string;
  rol: string; yetkiler: string[] | null; proje_limiti?: number | null;
  aktif?: boolean; created_at: string; son_giris: string | null;
}
export interface AylikFinans { ay: string; gelir: number; gider: number }
export interface YonetimOzet {
  surum: string; ortam: string;
  sayilar: { kullanici: number; proje: number; muhasebe: number; modul: number; dosya: number };
  dosya_boyut_bayt: number;
  rol_dagilimi: Record<string, number>;
  proje_tip: Record<string, number>;
  aylik_finans: AylikFinans[];
}
export interface YonetimVeri { id: string; owner_id: string; owner_email?: string; baslik: string; ek?: string; created_at?: string | null }

export const ozetGetir = () => iste<YonetimOzet>("/ozet");
export const kullanicilariGetir = () => iste<{ users: YonetimKullanici[] }>("/kullanicilar");
export const kullaniciGuncelle = (id: string, rol: string, yetkiler?: string[] | null) =>
  iste("/kullanicilar", { method: "POST", body: JSON.stringify({ id, rol, ...(yetkiler !== undefined ? { yetkiler } : {}) }) });
/** Üye bilgisi/limit düzenle (ad_soyad, firma, proje_limiti). */
export const kullaniciDuzenle = (id: string, alanlar: { ad_soyad?: string; firma?: string; proje_limiti?: number | null }) =>
  iste("/kullanicilar", { method: "POST", body: JSON.stringify({ id, ...alanlar }) });
export const kullaniciOlustur = (k: { email: string; ad_soyad: string; firma: string; rol: string }) =>
  iste<{ ok: boolean; gecici_sifre: string }>("/kullanicilar", { method: "PUT", body: JSON.stringify(k) });
export const kullaniciAktif = (id: string, aktif: boolean) =>
  iste("/kullanicilar", { method: "PATCH", body: JSON.stringify({ id, aktif }) });
export const kullaniciSil = (id: string) =>
  iste("/kullanicilar?id=" + encodeURIComponent(id), { method: "DELETE" });
export const veriGetir = (tip: string) => iste<{ satirlar: YonetimVeri[] }>("/veri?tip=" + encodeURIComponent(tip));
export const veriSilApi = (tip: string, id: string) =>
  iste("/veri?tip=" + encodeURIComponent(tip) + "&id=" + encodeURIComponent(id), { method: "DELETE" });

/** Tek projeyi incele (sahip + tam nesne). */
export const projeGetir = (owner: string, id: string) =>
  iste<{ proje: Record<string, unknown>; owner_email: string }>("/proje?owner=" + encodeURIComponent(owner) + "&id=" + encodeURIComponent(id));
/** Projenin verilen alanlarını güncelle. */
export const projeGuncelle = (owner: string, id: string, alanlar: Record<string, unknown>) =>
  iste<{ ok: boolean; proje: Record<string, unknown> }>("/proje", { method: "POST", body: JSON.stringify({ owner, id, alanlar }) });
