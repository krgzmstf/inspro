/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â
”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   insPRO â€” Muhasebe bulut senkronu (Supabase)

   Offline-first: localStorage ana depo, bu katman buluta yazar.
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â
”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

import { supabase } from "./supabase/client";
import { bulutAktif } from "./projeSenkron";
import type { MuhasebeKayit, KayitTipi, OdemeDurumu } from "./muhasebe";

interface MuhasebeSatir {
  id: string;
  project_id: string;
  tip: string;
  kategori: string;
  aciklama: string | null;
  taraf: string | null;
  belge_no: string | null;
  matrah: number;
  kdv_oran: number;
  kdv_tutar: number;
  tevkifat_oran: number;
  tevkifat_tutar: number;
  tutar: number;
  net: number;
  tarih: string;
  vade_tarihi: string | null;
  durum: string;
  odenen_tutar: number;
  hesap_id: string | null;
  created_at: string;
}

function satirToKayit(r: MuhasebeSatir): MuhasebeKayit {
  return {
    id: r.id,
    projectId: r.project_id,
    tip: r.tip as KayitTipi,
    kategori: r.kategori,
    aciklama: r.aciklama ?? "",
    taraf: r.taraf ?? "",
    belgeNo: r.belge_no ?? undefined,
    matrah: Number(r.matrah),
    kdvOran: r.kdv_oran,
    kdvTutar: Number(r.kdv_tutar),
    tevkifatOran: Number(r.tevkifat_oran),
    tevkifatTutar: Number(r.tevkifat_tutar),
    tutar: Number(r.tutar),
    net: Number(r.net),
    tarih: r.tarih,
    vadeTarihi: r.vade_tarihi ?? undefined,
    durum: r.durum as OdemeDurumu,
    odenenTutar: Number(r.odenen_tutar),
    hesapId: r.hesap_id ?? undefined,
    createdAt: r.created_at,
  };
}

function kayitToSatir(k: MuhasebeKayit): Omit<MuhasebeSatir, "created_at"> {
  return {
    id: k.id,
    project_id: k.projectId,
    tip: k.tip,
    kategori: k.kategori,
    aciklama: k.aciklama || null,
    taraf: k.taraf || null,
    belge_no: k.belgeNo || null,
    matrah: k.matrah,
    kdv_oran: k.kdvOran,
    kdv_tutar: k.kdvTutar,
    tevkifat_oran: k.tevkifatOran,
    tevkifat_tutar: k.tevkifatTutar,
    tutar: k.tutar,
    net: k.net,
    tarih: k.tarih,
    vade_tarihi: k.vadeTarihi || null,
    durum: k.durum,
    odenen_tutar: k.odenenTutar,
    hesap_id: k.hesapId || null,
  };
}

/** KaydÄ± buluta yaz (upsert). */
export async function muhasebeBulutaYaz(k: MuhasebeKayit): Promise<void> {
  try {
    const sb = supabase();
    if (!sb || !(await bulutAktif())) return;
    await sb.from("accounting").upsert(kayitToSatir(k), { onConflict: "id" });
  } catch { /* sessiz */ }
}

/** KaydÄ± buluttan sil. */
export async function muhasebeBuluttanSil(id: string): Promise<void> {
  try {
    const sb = supabase();
    if (!sb || !(await bulutAktif())) return;
    await sb.from("accounting").delete().eq("id", id);
  } catch { /* sessiz */ }
}

/** AÃ§Ä±lÄ±ÅŸ senkronu. */
export async function muhasebeSenkronla(yerel: MuhasebeKayit[]): Promise<MuhasebeKayit[] | null> {
  const sb = supabase();
  if (!sb || !(await bulutAktif())) return null;
  try {
    const { data, error } = await sb.from("accounting").select("*").order("tarih", { ascending: false }
);
    if (error) return null;
    const bulut = (data as MuhasebeSatir[]).map(satirToKayit);
    if (bulut.length === 0 && yerel.length > 0) {
      for (const k of yerel) await sb.from("accounting").upsert(kayitToSatir(k), { onConflict: "id" });
      return yerel;
    }
    return bulut;
  } catch {
    return null;
  }
}
