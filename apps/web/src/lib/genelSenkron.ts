/* ──────────────────────────────────────────────────────────
   insPRO — Genel modül bulut senkronu (self-hosted Supabase)

   metraj, iş süreçleri, saha, personel, puantaj, teklif, hakediş,
   aşama kalemleri, kasa/banka, firma, bilgi tabanı — her modülün
   tüm localStorage dizisi tek satırda (modul_veri tablosu) saklanır.

   Supabase oturumu yoksa no-op → uygulama localStorage ile çalışır.
   ────────────────────────────────────────────────────────── */

import { blobOku, blobYaz, aktifKullaniciId } from "./sb";

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
  const key = MODULLER[modul];
  if (!key) return;
  await blobYaz(modul, oku(key));
}

/** Açılış senkronu: bulut otorite; bulutta olmayan/boş olanlarda yereli yukarı taşır. */
export async function tumModulleriSenkronla(): Promise<boolean> {
  if ((await aktifKullaniciId()) === null) return false;
  try {
    for (const [modul, key] of Object.entries(MODULLER)) {
      const bulut = (await blobOku(modul)) ?? [];
      const yerel = oku(key);
      if (bulut.length === 0 && yerel.length > 0) {
        await blobYaz(modul, yerel); // yereli yukarı taşı
      } else {
        localStorage.setItem(key, JSON.stringify(bulut)); // bulut otorite
      }
    }
    return true;
  } catch {
    return false;
  }
}
