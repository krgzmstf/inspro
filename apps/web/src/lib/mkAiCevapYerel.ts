/* ──────────────────────────────────────────────────────────
   mk_ai — Çevrimdışı yanıt (LLM'siz, yerel bilgi tabanı)

   İnternet yokken veya sunucuya ulaşılamadığında mk_ai sohbeti bu
   yedeğe düşer: kullanıcının yüklediği dökümanlar (bilgiTabani) +
   yerleşik mevzuat üzerinde `yonetmelikAra` ile arar ve kaynak
   göstererek ilgili maddeleri döndürür. Vektör DB gerekmez.
   ────────────────────────────────────────────────────────── */

import { yonetmelikAra } from "./yonetmelik";
import { loadBilgiler } from "./bilgiTabani";

export interface YerelKaynak { id: string; baslik: string; kaynak: string }
export interface YerelCevap { text: string; kaynaklar: YerelKaynak[] }

/** Soruya yerel bilgi tabanından kaynak-gösterimli yanıt üretir. */
export function yerelDanis(soru: string): YerelCevap {
  const isabet = yonetmelikAra(soru, 4, loadBilgiler());
  if (!isabet.length) {
    return {
      text:
        "📴 **Çevrimdışısınız.** Bu konuda yüklediğiniz dökümanlarda veya yerleşik " +
        "mevzuatta eşleşme bulamadım. İnternete bağlanınca mk_ai tam (AI) yanıt verecek. " +
        "İpucu: ilgili PDF/şartnameyi **Bilgi Tabanı**'na yükleyin; sonra çevrimdışı da yanıtlayabilirim.",
      kaynaklar: [],
    };
  }
  const govde = isabet
    .map((k) => `• **${k.baslik}**\n${k.metin}\n_Kaynak: ${k.kaynak}_`)
    .join("\n\n");
  return {
    text:
      "📴 **Çevrimdışı yanıt** (yüklediğiniz dökümanlar + yerleşik mevzuattan):\n\n" + govde,
    kaynaklar: isabet.map((k) => ({ id: k.id, baslik: k.baslik, kaynak: k.kaynak })),
  };
}
