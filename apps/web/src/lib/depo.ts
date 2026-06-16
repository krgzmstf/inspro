/* ──────────────────────────────────────────────────────────
   insPRO — Dosya/Fotoğraf depolama

   Oturum açıkken fotoğraf backend'e (POST /yukle) base64 olarak
   gönderilir; backend diske yazıp kalıcı bir URL döner. Bu URL
   <img src> olarak kullanılır. Oturum yoksa null → çağıran base64'ü
   saklamaya devam eder (yerel mod).
   ────────────────────────────────────────────────────────── */

import { API_URL, apiPost, oturumVar } from "./api";

/** Base64 data URL'i backend'e yükler; kalıcı URL döner. Olmazsa null. */
export async function fotoYukle(dataUrl: string): Promise<string | null> {
  try {
    if (!oturumVar()) return null;
    const r = await apiPost<{ url: string }>("/yukle", { dataUrl });
    if (!r?.url) return null;
    // Göreli yolu mutlak adrese çevir (farklı origin'den de görünsün)
    return r.url.startsWith("http") ? r.url : API_URL + r.url;
  } catch {
    return null;
  }
}
