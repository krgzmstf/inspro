/* ──────────────────────────────────────────────────────────
   insPRO — Rol & Yetki yönetimi (RBAC)

   4 rol:
   • yonetici   → her şey + SADECE o proje oluşturabilir
   • sefi       → şantiye şefi (yöneticinin verdiği modüller)
   • taseron    → taşeron (yöneticinin verdiği modüller)
   • muhasebeci → personel, muhasebe, genel muhasebe, teklif, hakediş (tutar düzenler)

   Yönetici, "Yönetim" panelinden her kullanıcıya rol atar VE isterse
   kişiye özel modül izni (yetkiler) verir. yetkiler doluysa menü ona
   göre; boşsa rolün varsayılan menüsü geçerli.
   ────────────────────────────────────────────────────────── */

import { supabase } from "./supabase/client";
import { aktifKullaniciId } from "./sb";

export type Rol = "yonetici" | "sefi" | "taseron" | "muhasebeci";

export const ROL_ETIKET: Record<Rol, string> = {
  yonetici: "Yönetici",
  sefi: "Şantiye Şefi",
  taseron: "Taşeron",
  muhasebeci: "Muhasebeci",
};

/** Atanabilir/seçilebilir menüler (Yönetim panelinde kişiye özel izin için). */
export const MENU_SECENEKLERI: { href: string; label: string }[] = [
  { href: "/panel", label: "Projeler" },
  { href: "/panel/is-surecleri", label: "İş Süreçleri" },
  { href: "/panel/metraj", label: "Keşif & Metraj" },
  { href: "/panel/maliyet", label: "Maliyet" },
  { href: "/panel/teklif", label: "Teklif" },
  { href: "/panel/hakedis", label: "Hakediş" },
  { href: "/panel/personel", label: "Personel & Puantaj" },
  { href: "/panel/muhasebe", label: "Muhasebe" },
  { href: "/panel/genel-muhasebe", label: "Genel Muhasebe" },
  { href: "/panel/saha", label: "Saha Takibi" },
  { href: "/panel/3d", label: "3B Görselleştirme" },
  { href: "/panel/plan3d", label: "Plan → 3B Stüdyo" },
  { href: "/panel/mk-ai", label: "mk_ai" },
  { href: "/panel/bilgi", label: "Bilgi Tabanı" },
];

/** Her rolün varsayılan menüleri ("*" = tümü). */
export const ROL_MENU: Record<Rol, string[] | "*"> = {
  yonetici: "*",
  muhasebeci: ["/panel", "/panel/personel", "/panel/muhasebe", "/panel/genel-muhasebe", "/panel/teklif", "/panel/hakedis"],
  sefi: ["/panel", "/panel/is-surecleri", "/panel/saha", "/panel/metraj"],
  taseron: ["/panel", "/panel/is-surecleri", "/panel/saha"],
};

/** Eski rol adlarını yeni 4 role çevirir. */
export function rolNormalize(r: string | null | undefined): Rol {
  if (r === "yonetici" || r === "sefi" || r === "taseron" || r === "muhasebeci") return r;
  if (r === "sahip" || r === "ofis") return "yonetici";
  if (r === "usta") return "taseron";
  return "yonetici"; // bilinmeyen/yerel → yönetici (kilitlenme olmasın)
}

const KEY = "inspro-rol";
const KEY_Y = "inspro-yetkiler";
const KEY_SA = "inspro-superadmin";

/** Varsayılan proje limiti (kişiye özel ayar yoksa). */
export const VARSAYILAN_PROJE_LIMITI = 3;

export interface Yetki { rol: Rol; yetkiler: string[] | null; superAdmin: boolean }

export function yerelYetki(): Yetki {
  if (typeof window === "undefined") return { rol: "yonetici", yetkiler: null, superAdmin: false };
  const rol = rolNormalize(localStorage.getItem(KEY));
  let yetkiler: string[] | null = null;
  try { const y = JSON.parse(localStorage.getItem(KEY_Y) || "null"); if (Array.isArray(y)) yetkiler = y; } catch { /* yok */ }
  const superAdmin = localStorage.getItem(KEY_SA) === "1";
  return { rol, yetkiler, superAdmin };
}

/** Aktif kullanıcının rol + özel izinler + süper admin bilgisini getirir (profiles tablosundan). */
export async function yetkiGetir(): Promise<Yetki> {
  try {
    const c = supabase();
    const uid = await aktifKullaniciId();
    if (c && uid) {
      const { data: p } = await c.from("profiles").select("rol, yetkiler, gizli").eq("id", uid).maybeSingle();
      const rol = rolNormalize(p?.rol);
      const yetkiler = Array.isArray(p?.yetkiler) ? p.yetkiler : null;
      const superAdmin = p?.gizli === true;
      localStorage.setItem(KEY, rol);
      localStorage.setItem(KEY_Y, JSON.stringify(yetkiler));
      localStorage.setItem(KEY_SA, superAdmin ? "1" : "0");
      return { rol, yetkiler, superAdmin };
    }
  } catch { /* sessiz */ }
  return yerelYetki();
}

/** Geriye uyumlu: sadece rolü döndürür. */
export async function rolGetir(): Promise<Rol> {
  return (await yetkiGetir()).rol;
}

/** Aktif kullanıcı gizli süper admin mi? */
export async function superAdminMi(): Promise<boolean> {
  return (await yetkiGetir()).superAdmin;
}

/**
 * Aktif kullanıcının etkin proje limitini döndürür.
 *   süper admin → Infinity (sınırsız)
 *   proje_limiti = 0 → Infinity (sınırsız)
 *   proje_limiti > 0 → o değer
 *   yoksa → VARSAYILAN_PROJE_LIMITI
 */
export async function projeLimitiGetir(): Promise<number> {
  try {
    const c = supabase();
    const uid = await aktifKullaniciId();
    if (c && uid) {
      const { data: p } = await c.from("profiles").select("gizli, proje_limiti").eq("id", uid).maybeSingle();
      if (p?.gizli === true) return Infinity;
      const l = p?.proje_limiti;
      if (l === 0) return Infinity;
      if (typeof l === "number" && l > 0) return l;
    }
  } catch { /* sessiz */ }
  return VARSAYILAN_PROJE_LIMITI;
}

/** Kişiye özel izin (yetkiler) doluysa onu, değilse rolün varsayılanını kullanır. */
export function menuyeYetkili(rol: Rol, href: string, yetkiler?: string[] | null): boolean {
  const path = href.split("?")[0];
  const liste = yetkiler && yetkiler.length > 0 ? yetkiler : ROL_MENU[rol];
  if (liste === "*") return true;
  // Projeler (/panel), Profilim ve Sohbet herkese açık
  if (path === "/panel" || path === "/panel/profil" || path === "/panel/sohbet") return true;
  return (liste as string[]).some((h) => path === h || path.startsWith(h + "/"));
}

/** Proje (dosya) oluşturma yetkisi: yalnız yönetici. */
export function projeOlusturabilir(rol: Rol): boolean {
  return rol === "yonetici";
}
