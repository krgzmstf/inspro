/* ──────────────────────────────────────────────────────────
   insPRO — Dosya/Fotoğraf depolama

   NOT: Kendi backend'imizde dosya yükleme ucu henüz yok; bu yüzden
   fotoğraflar şimdilik base64 (data URL) olarak saklanır. İleride
   backend'e dosya yükleme eklenince burası onu kullanacak.
   ────────────────────────────────────────────────────────── */

/** Şimdilik null döner → çağıran base64'ü saklamaya devam eder. */
export async function fotoYukle(_dataUrl: string): Promise<string | null> {
  return null;
}
