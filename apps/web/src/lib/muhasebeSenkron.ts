/* ──────────────────────────────────────────────────────────
   insPRO — Muhasebe bulut senkronu (kendi FastAPI backend'imiz)
   ────────────────────────────────────────────────────────── */

import { apiGet, apiPost, apiDelete, oturumVar } from "./api";
import type { MuhasebeKayit } from "./muhasebe";

export async function muhasebeBulutaYaz(k: MuhasebeKayit): Promise<void> {
  try {
    if (!oturumVar()) return;
    await apiPost("/muhasebe", k);
  } catch { /* sessiz */ }
}

export async function muhasebeBuluttanSil(id: string): Promise<void> {
  try {
    if (!oturumVar()) return;
    await apiDelete("/muhasebe/" + id);
  } catch { /* sessiz */ }
}

export async function muhasebeSenkronla(yerel: MuhasebeKayit[]): Promise<MuhasebeKayit[] | null> {
  if (!oturumVar()) return null;
  try {
    const bulut = await apiGet<MuhasebeKayit[]>("/muhasebe");
    if (bulut.length === 0 && yerel.length > 0) {
      for (const k of yerel) await apiPost("/muhasebe", k);
      return yerel;
    }
    return bulut;
  } catch {
    return null;
  }
}
