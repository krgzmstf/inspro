/* ──────────────────────────────────────────────────────────
   insPRO — Projeler bulut senkronu (kendi FastAPI backend'imiz)

   localStorage ana depo; bu katman değişiklikleri backend'e yazar
   ve açılışta çeker. Oturum (token) yoksa no-op → localStorage ile çalışır.
   ────────────────────────────────────────────────────────── */

import { apiGet, apiPost, apiDelete, oturumVar } from "./api";
import type { Project } from "./projects";

/** Oturum açık mı? (bulut senkronu aktif mi) */
export async function bulutAktif(): Promise<boolean> {
  return oturumVar();
}

export async function projeyiBulutaYaz(p: Project): Promise<void> {
  try {
    if (!oturumVar()) return;
    await apiPost("/projeler", p);
  } catch { /* sessiz */ }
}

export async function projeyiBuluttanSil(id: string): Promise<void> {
  try {
    if (!oturumVar()) return;
    await apiDelete("/projeler/" + id);
  } catch { /* sessiz */ }
}

/** Açılış senkronu: bulut otorite; bulut boş + yerel doluysa yereli taşır. */
export async function projeleriSenkronla(yerel: Project[]): Promise<Project[] | null> {
  if (!oturumVar()) return null;
  try {
    const bulut = await apiGet<Project[]>("/projeler");
    if (bulut.length === 0 && yerel.length > 0) {
      for (const p of yerel) await apiPost("/projeler", p);
      return yerel;
    }
    return bulut;
  } catch {
    return null;
  }
}
