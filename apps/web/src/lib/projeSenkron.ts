/* ──────────────────────────────────────────────────────────
   insPRO — Projeler bulut senkronu (offline-first)

   localStorage ana depo; senkronKuyruk bulut (modul_veri/'projects')
   ile eşitler. Çevrimdışı düzenlemeler kuyruğa alınır, online olunca
   otomatik itilir. Açılış senkronunda kirli (offline) veri korunur.
   ────────────────────────────────────────────────────────── */

import { blobOku, aktifKullaniciId } from "./sb";
import { degisti, kirliMi, cevrimici } from "./senkronKuyruk";
import type { Project } from "./projects";

const MODUL = "projects";

/** Oturum (bulut senkronu) açık mı? */
export async function bulutAktif(): Promise<boolean> {
  return (await aktifKullaniciId()) !== null;
}

export async function projeyiBulutaYaz(_p: Project): Promise<void> {
  degisti(MODUL); // localStorage zaten güncellendi → tüm diziyi itele/kuyrukla
}

export async function projeyiBuluttanSil(_id: string): Promise<void> {
  degisti(MODUL);
}

/** Açılış senkronu: kirliyse yerel kazanır; değilse bulut otorite. */
export async function projeleriSenkronla(yerel: Project[]): Promise<Project[] | null> {
  if ((await aktifKullaniciId()) === null) return null; // oturum yok
  if (kirliMi(MODUL)) { if (cevrimici()) degisti(MODUL); return yerel; } // yerel kazanır
  if (!cevrimici()) return yerel;
  const bulut = await blobOku<Project>(MODUL);
  if (bulut === null) return yerel;
  if (bulut.length === 0 && yerel.length > 0) { degisti(MODUL); return yerel; }
  return bulut;
}
