/* ──────────────────────────────────────────────────────────
   insPRO — Projeler bulut senkronu (self-hosted Supabase)

   localStorage ana depo; bu katman bulut (modul_veri/'projects')
   ile eşitler. Oturum yoksa no-op → localStorage ile çalışır.
   ────────────────────────────────────────────────────────── */

import { blobOku, blobYaz, aktifKullaniciId } from "./sb";
import type { Project } from "./projects";

const MODUL = "projects";

/** Oturum (bulut senkronu) açık mı? */
export async function bulutAktif(): Promise<boolean> {
  return (await aktifKullaniciId()) !== null;
}

export async function projeyiBulutaYaz(p: Project): Promise<void> {
  const arr = await blobOku<Project>(MODUL);
  if (arr === null) return; // oturum yok
  const yeni = [p, ...arr.filter((x) => x.id !== p.id)];
  await blobYaz(MODUL, yeni);
}

export async function projeyiBuluttanSil(id: string): Promise<void> {
  const arr = await blobOku<Project>(MODUL);
  if (arr === null) return;
  await blobYaz(MODUL, arr.filter((x) => x.id !== id));
}

/** Açılış senkronu: bulut otorite; bulut boş + yerel doluysa yereli taşır. */
export async function projeleriSenkronla(yerel: Project[]): Promise<Project[] | null> {
  const bulut = await blobOku<Project>(MODUL);
  if (bulut === null) return null; // oturum yok
  if (bulut.length === 0 && yerel.length > 0) {
    await blobYaz(MODUL, yerel);
    return yerel;
  }
  return bulut;
}
