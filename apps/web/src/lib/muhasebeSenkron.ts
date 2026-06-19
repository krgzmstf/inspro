/* ──────────────────────────────────────────────────────────
   insPRO — Muhasebe bulut senkronu (offline-first)
   modul_veri/'accounting' satırında JSONB dizi olarak tutulur.
   Çevrimdışı düzenlemeler kuyruğa alınır; açılışta kirli veri korunur.
   ────────────────────────────────────────────────────────── */

import { blobOku, aktifKullaniciId } from "./sb";
import { degisti, kirliMi, cevrimici } from "./senkronKuyruk";
import type { MuhasebeKayit } from "./muhasebe";

const MODUL = "accounting";

export async function muhasebeBulutaYaz(_k: MuhasebeKayit): Promise<void> {
  degisti(MODUL);
}

export async function muhasebeBuluttanSil(_id: string): Promise<void> {
  degisti(MODUL);
}

/** Açılış senkronu: kirliyse yerel kazanır; değilse bulut otorite. */
export async function muhasebeSenkronla(yerel: MuhasebeKayit[]): Promise<MuhasebeKayit[] | null> {
  if ((await aktifKullaniciId()) === null) return null;
  if (kirliMi(MODUL)) { if (cevrimici()) degisti(MODUL); return yerel; }
  if (!cevrimici()) return yerel;
  const bulut = await blobOku<MuhasebeKayit>(MODUL);
  if (bulut === null) return yerel;
  if (bulut.length === 0 && yerel.length > 0) { degisti(MODUL); return yerel; }
  return bulut;
}
