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

import { apiGet, apiPut, oturumVar } from "./api";

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

/** Bir modülün güncel verisini buluta yaz. Oturum yoksa sessiz geçer. */
export async function modulYaz(modul: string): Promise<void> {
  try {
    if (!oturumVar()) return;
    const key = MODULLER[modul];
    if (!key) return;
    await apiPut("/modul/" + modul, { veri: oku(key) });
  } catch { /* sessiz */ }
}

/** Açılış senkronu: bulut otorite; bulutta olmayan/boş olanlarda yereli yukarı taşır.
   localStorage'ı günceller → true döner (senkron yapıldıysa). */
export async function tumModulleriSenkronla(): Promise<boolean> {
  if (!oturumVar()) return false;
  try {
    for (const [modul, key] of Object.entries(MODULLER)) {
      const r = await apiGet<{ veri: unknown[] }>("/modul/" + modul);
      const bulut = Array.isArray(r.veri) ? r.veri : [];
      const yerel = oku(key);
      if (bulut.length === 0 && yerel.length > 0) {
        // Bulut boş ama yerel dolu → yereli yukarı taşı
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
