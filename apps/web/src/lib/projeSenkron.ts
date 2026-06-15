/* ──────────────────────────────────────────────────────────
   insPRO — Projeler bulut senkronu (Supabase)

   Offline-first hafif yaklaşım: localStorage senkron ana depo
   olarak kalır (tüm sayfalar değişmeden çalışır); bu katman
   değişiklikleri buluta yazar ve açılışta buluttan çeker.

   Supabase oturumu YOKSA (kayıtsız/yerel giriş) tüm fonksiyonlar
   nazikçe no-op döner → uygulama localStorage ile çalışmaya devam.
   ────────────────────────────────────────────────────────── */

import { supabase, supabaseVar } from "./supabase/client";
import type { Project } from "./projects";

interface Satir {
  id: string; name: string; city: string | null; type: string | null;
  area: number | null; floors: number | null; budget: number | null;
  phases: Project["phases"]; katlar: Project["katlar"] | null;
  bina: Project["bina"] | null; kendi_fiyat: Project["kendiFiyat"] | null;
  poz_kutuphane: string | null; created_at: string;
}

function satirToProje(r: Satir): Project {
  return {
    id: r.id, name: r.name, city: r.city ?? "", type: (r.type as Project["type"]) ?? "konut",
    area: r.area ?? 0, floors: r.floors ?? 1, budget: r.budget ?? null,
    createdAt: r.created_at, phases: r.phases ?? [],
    katlar: r.katlar ?? undefined, bina: r.bina ?? undefined,
    kendiFiyat: r.kendi_fiyat ?? undefined, pozKutuphane: r.poz_kutuphane ?? undefined,
  };
}

function projeToSatir(p: Project): Omit<Satir, "created_at"> {
  return {
    id: p.id, name: p.name, city: p.city, type: p.type,
    area: p.area, floors: p.floors, budget: p.budget,
    phases: p.phases, katlar: p.katlar ?? null, bina: p.bina ?? null,
    kendi_fiyat: p.kendiFiyat ?? null, poz_kutuphane: p.pozKutuphane ?? null,
  };
}

/** Aktif Supabase oturumu var mı? (yoksa bulut senkronu devre dışı) */
export async function bulutAktif(): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;
  const { data } = await sb.auth.getSession();
  return !!data.session;
}

/** Tek projeyi buluta yaz (upsert). Oturum yoksa sessizce geçer. */
export async function projeyiBulutaYaz(p: Project): Promise<void> {
  try {
    const sb = supabase();
    if (!sb || !(await bulutAktif())) return;
    await sb.from("projects").upsert(projeToSatir(p), { onConflict: "id" });
  } catch { /* sessiz: localStorage zaten kaynak */ }
}

/** Projeyi buluttan sil. */
export async function projeyiBuluttanSil(id: string): Promise<void> {
  try {
    const sb = supabase();
    if (!sb || !(await bulutAktif())) return;
    await sb.from("projects").delete().eq("id", id);
  } catch { /* sessiz */ }
}

/**
 * Açılış senkronu:
 *  • Oturum yoksa → null (localStorage kullanılır)
 *  • Bulutta veri varsa → bulut otorite, onu döndür
 *  • Bulut boş + yerelde varsa → yereli buluta taşı (ilk migrasyon), yereli döndür
 */
export async function projeleriSenkronla(yerel: Project[]): Promise<Project[] | null> {
  const sb = supabase();
  if (!sb || !(await bulutAktif())) return null;
  try {
    const { data, error } = await sb.from("projects").select("*").order("created_at", { ascending: false });
    if (error) return null;
    const bulut = (data as Satir[]).map(satirToProje);
    if (bulut.length === 0 && yerel.length > 0) {
      for (const p of yerel) await sb.from("projects").upsert(projeToSatir(p), { onConflict: "id" });
      return yerel;
    }
    return bulut;
  } catch {
    return null;
  }
}

export { supabaseVar };
