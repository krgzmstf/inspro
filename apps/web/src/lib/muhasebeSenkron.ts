/* ──────────────────────────────────────────────────────────
   insPRO — Muhasebe bulut senkronu (self-hosted Supabase)
   modul_veri/'accounting' satırında JSONB dizi olarak tutulur.
   ────────────────────────────────────────────────────────── */

import { blobOku, blobYaz } from "./sb";
import type { MuhasebeKayit } from "./muhasebe";

const MODUL = "accounting";

export async function muhasebeBulutaYaz(k: MuhasebeKayit): Promise<void> {
  const arr = await blobOku<MuhasebeKayit>(MODUL);
  if (arr === null) return;
  const yeni = [k, ...arr.filter((x) => x.id !== k.id)];
  await blobYaz(MODUL, yeni);
}

export async function muhasebeBuluttanSil(id: string): Promise<void> {
  const arr = await blobOku<MuhasebeKayit>(MODUL);
  if (arr === null) return;
  await blobYaz(MODUL, arr.filter((x) => x.id !== id));
}

export async function muhasebeSenkronla(yerel: MuhasebeKayit[]): Promise<MuhasebeKayit[] | null> {
  const bulut = await blobOku<MuhasebeKayit>(MODUL);
  if (bulut === null) return null;
  if (bulut.length === 0 && yerel.length > 0) {
    await blobYaz(MODUL, yerel);
    return yerel;
  }
  return bulut;
}
