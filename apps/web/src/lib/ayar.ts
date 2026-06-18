/* ──────────────────────────────────────────────────────────
   insPRO — Genel ayarlar (kodsuz yönetim)

   Backend'deki "ayarlar" tablosundan menü ve site içeriğini okur/yazar.
   Yönetici panelden değiştirir; tüm kullanıcılar okur.
   ────────────────────────────────────────────────────────── */

import { supabase } from "./supabase/client";
import { aktifKullaniciId } from "./sb";

/** Panel menü kataloğu — tek kaynak (layout + yönetim paneli kullanır). */
export interface MenuOge { href: string; label: string; icon: string; img?: string }

export const MENU_KATALOG: MenuOge[] = [
  { href: "/panel", label: "Projeler", icon: "🏗️" },
  { href: "/panel/is-surecleri", label: "İş Süreçleri", icon: "📋" },
  { href: "/panel/metraj", label: "Keşif & Metraj", icon: "📏" },
  { href: "/panel/maliyet", label: "Maliyet", icon: "💰" },
  { href: "/panel/teklif", label: "Teklif", icon: "📄" },
  { href: "/panel/hakedis", label: "Hakediş", icon: "🧾" },
  { href: "/panel/pozlar?lib=kut1", label: "POZ KÜTÜPHANESİ 1", icon: "📙" },
  { href: "/panel/pozlar?lib=kut2", label: "TÜM POZLAR", icon: "📚" },
  { href: "/panel/pozlar?lib=kut3", label: "ÖZEL POZ KÜTÜPHANESİ", icon: "📗" },
  { href: "/panel/personel", label: "Personel & Puantaj", icon: "👷" },
  { href: "/panel/muhasebe", label: "Muhasebe", icon: "📒" },
  { href: "/panel/genel-muhasebe", label: "Genel Muhasebe", icon: "📊" },
  { href: "/panel/saha", label: "Saha Takibi", icon: "📸" },
  { href: "/panel/3d", label: "3B Görselleştirme", icon: "🏢" },
  { href: "/panel/plan3d", label: "Plan → 3B Stüdyo", icon: "🧊" },
  { href: "/panel/mk-ai", label: "mk_ai (Risk)", icon: "🤖", img: "/mk-ai-logo.jpg" },
  { href: "/panel/bilgi", label: "Bilgi Tabanı", icon: "📚" },
  { href: "/panel/profil", label: "Profilim & Güvenlik", icon: "🪪" },
  { href: "/panel/yonetim", label: "Yönetim", icon: "👤" },
];

/** Menü ayarı: gizlenecek modüller, yeniden adlandırma, sıralama. */
export interface MenuAyar {
  gizli?: string[];                  // gizlenecek href'ler
  etiket?: Record<string, string>;   // href → yeni etiket
  sira?: string[];                   // href sırası (önce gelenler üstte)
}

/** Site içerik ayarı. */
export interface SiteAyar {
  siteAdi?: string;
  slogan?: string;
  telefon?: string;
  eposta?: string;
  adres?: string;
}

export async function ayarGetir<T>(anahtar: string, varsayilan: T): Promise<T> {
  try {
    const c = supabase();
    if (!c || (await aktifKullaniciId()) === null) return varsayilan;
    const { data, error } = await c.from("ayarlar").select("deger").eq("anahtar", anahtar).maybeSingle();
    if (error) throw error;
    return ((data?.deger ?? varsayilan) as T);
  } catch {
    return varsayilan;
  }
}

export async function ayarYaz(anahtar: string, deger: unknown): Promise<void> {
  const c = supabase();
  if (!c) throw new Error("Supabase yapılandırılmadı.");
  const { error } = await c.from("ayarlar").upsert(
    { anahtar, deger, updated_at: new Date().toISOString() },
    { onConflict: "anahtar" },
  );
  if (error) throw error;
}

/** Menü öğesi (href + label) listesine menü ayarını uygular. */
export function menuyuUygula<T extends { href: string; label: string }>(
  ogeler: T[],
  ayar: MenuAyar | null,
): T[] {
  if (!ayar) return ogeler;
  const gizli = new Set(ayar.gizli ?? []);
  let sonuc = ogeler
    .filter((o) => !gizli.has(o.href))
    .map((o) => ({ ...o, label: ayar.etiket?.[o.href] ?? o.label }));
  if (ayar.sira && ayar.sira.length) {
    const sira = ayar.sira;
    sonuc = [...sonuc].sort((a, b) => {
      const ia = sira.indexOf(a.href);
      const ib = sira.indexOf(b.href);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }
  return sonuc;
}
