/* ──────────────────────────────────────────────────────────
   insPRO — Dosya/Fotoğraf depolama (self-hosted Supabase Storage)

   Oturum açıkken fotoğraf 'saha-foto' bucket'ına yüklenir ve kalıcı
   genel URL döner (<img src>). Oturum yoksa null → çağıran base64'ü
   saklamaya devam eder (yerel mod).
   ────────────────────────────────────────────────────────── */

import { supabase } from "./supabase/client";
import { aktifKullaniciId } from "./sb";

const BUCKET = "saha-foto";

/** Base64 data URL'i Storage'a yükler; kalıcı genel URL döner. Olmazsa null. */
export async function fotoYukle(dataUrl: string): Promise<string | null> {
  try {
    const c = supabase();
    if (!c) return null;
    const uid = await aktifKullaniciId();
    if (!uid) return null;

    // data:image/png;base64,... → Blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const uzanti = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const yol = `${uid}/${crypto.randomUUID()}.${uzanti}`;

    const { error } = await c.storage.from(BUCKET).upload(yol, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: false,
    });
    if (error) return null;

    const { data } = c.storage.from(BUCKET).getPublicUrl(yol);
    return data.publicUrl || null;
  } catch {
    return null;
  }
}
