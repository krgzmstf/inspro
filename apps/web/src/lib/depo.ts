/* ──────────────────────────────────────────────────────────
   insPRO — Dosya/Fotoğraf depolama (Supabase Storage)

   Saha fotoğrafları DB yerine Storage'a yüklenir; sadece LİNK
   saklanır → veri şişmez, hızlı olur. Oturum yoksa (kayıtsız/offline)
   base64 data URL'e geri düşülür (uygulama yine çalışır).
   ────────────────────────────────────────────────────────── */

import { supabase } from "./supabase/client";
import { bulutAktif } from "./projeSenkron";

const BUCKET = "saha-foto";

/** data URL'i Storage'a yükler, herkese açık linki döndürür.
   Oturum yoksa null → çağıran base64'ü saklamaya devam eder. */
export async function fotoYukle(dataUrl: string): Promise<string | null> {
  try {
    if (!dataUrl.startsWith("data:")) return dataUrl; // zaten link
    const sb = supabase();
    if (!sb || !(await bulutAktif())) return null;
    const blob = await (await fetch(dataUrl)).blob();
    const ext = blob.type.includes("png") ? "png" : "jpg";
    const yol = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(yol, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: false,
    });
    if (error) return null;
    return sb.storage.from(BUCKET).getPublicUrl(yol).data.publicUrl;
  } catch {
    return null;
  }
}
