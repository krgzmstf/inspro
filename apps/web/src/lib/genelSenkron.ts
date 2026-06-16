/* ──────────────────────────────────────────────────────────
   insPRO — Genel modül bulut senkronu (JSONB blob)

   metraj, iş süreçleri, saha, personel, puantaj, teklif, hakediş,
   aşama kalemleri, kasa/banka, firma, bilgi tabanı — her modülün
   tüm localStorage dizisi tek satırda (modul_veri tablosu) saklanır.

   • modulYaz(modul): o modülün güncel localStorage verisini buluta yazar.
   • tumModulleriSenkronla(): açılışta buluttan çeker (bulut otorite);
     bulutta yoksa yereli yukarı taşır (ilk migrasyon).

   Supabase oturumu yoksa no-op → uygulama localStorage ile çalışır.
   ────────────────────────────────────────────────────────── */

import { supabase } from "./supabase/client";
import { bulutAktif } from "./projeSenkron";

/** modul adı → localStorage anahtarı */
const MODULLER: Record<string, string> = {
  "metraj": "inspro-metraj",
  "issurecleri": "inspro-issurecleri",
  "saha": "inspro-saha",
  "personel": "inspro-personel",
  "puantaj": "inspro-puantaj",
  "teklif": "inspro-teklif",
  "hakedis": "inspro-hakedis",
  "asama-kalem": "inspro-asama-kalem",
  "finans-hesap": "inspro-finans-hesap",
  "firma": "inspro-firma",
  "bilgi-tabani": "inspro-bilgi-tabani",
};

function oku(key: string): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Bir modülün güncel verisini buluta yaz (upsert). Oturum yoksa sessiz geçer. */
export async function modulYaz(modul: string): Promise<void> {
  try {
    const sb = supabase();
    if (!sb || !(await bulutAktif())) return;
    const key = MODULLER[modul];
    if (!key) return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    await sb.from("modul_veri").upsert(
      { owner_id: session.user.id, modul, veri: oku(key), updated_at: new Date().toISOString() },
      { onConflict: "owner_id,modul" },
    );
  } catch { /* sessiz */ }
}

/** Açılış senkronu: bulut otorite; bulutta olmayan/boş olanlarda yereli yukarı taşır.
   localStorage'ı günceller → true döner (senkron yapıldıysa). */
export async function tumModulleriSenkronla(): Promise<boolean> {
  const sb = supabase();
  if (!sb || !(await bulutAktif())) return false;
  try {
    const { data, error } = await sb.from("modul_veri").select("modul, veri");
    if (error) return false;
    const bulutMap = new Map<string, unknown[]>(
      (data ?? []).map((r: { modul: string; veri: unknown[] }) => [r.modul, Array.isArray(r.veri) ? r.veri : []]),
    );
    for (const [modul, key] of Object.entries(MODULLER)) {
      const bulut = bulutMap.get(modul);
      const yerel = oku(key);
      if (bulut === undefined) {
        // Bulutta hiç yok → yerelde varsa yukarı taşı
        if (yerel.length > 0) await modulYaz(modul);
      } else if (bulut.length === 0 && yerel.length > 0) {
        // Bulut boş ama yerel dolu → yereli yukarı taşı (üzerine yazma)
        await modulYaz(modul);
      } else {
        // Bulut otorite
        localStorage.setItem(key, JSON.stringify(bulut));
      }
    }
    return true;
  } catch {
    return false;
  }
}
