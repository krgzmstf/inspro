/* ──────────────────────────────────────────────────────────
   insPRO — Genel modül bulut senkronu (offline-first)

   Geriye dönük uyum katmanı: tüm senkron mantığı artık merkezi
   senkronKuyruk.ts'tedir (kirli işaretleme + reconnect kuyruğu +
   çakışma koruması). Bu dosya eski çağrıları oraya yönlendirir.
   ────────────────────────────────────────────────────────── */

import { aktifKullaniciId } from "./sb";
import { degisti, acilisSenkron, MODUL_ANAHTAR } from "./senkronKuyruk";

/** Bir modülün güncel verisini buluta yaz (offline ise kuyruğa alınır). */
export async function modulYaz(modul: string): Promise<void> {
  if (!MODUL_ANAHTAR[modul]) return;
  degisti(modul); // kirli işaretle + online ise hemen itele
}

/** Açılış senkronu → merkezi kuyruk (çakışma korumalı). */
export async function tumModulleriSenkronla(): Promise<boolean> {
  if ((await aktifKullaniciId()) === null) return false;
  try { await acilisSenkron(); return true; }
  catch { return false; }
}
