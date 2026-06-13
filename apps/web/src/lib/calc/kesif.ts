/* ──────────────────────────────────────────────────────────
   insPRO Hesap Motoru — Keşif Özeti
   Metraj satırlarından (poz × miktar) keşif toplamlarını üretir.
   Saf fonksiyon: depolama ve UI'dan bağımsız, birim testli.
   ────────────────────────────────────────────────────────── */

import { type Poz, etkinFiyat } from "@/lib/pozlar";

export interface KesifGirdi {
  pozKod: string;
  miktar: number;
}

export interface KesifSatir extends KesifGirdi {
  poz: Poz;
  tutar: number;
}

export interface KesifOzet {
  satirlar: KesifSatir[];
  kategoriToplamlari: { kategori: string; tutar: number }[];
  genelToplam: number;
}

export function kesifOzeti(
  girdiler: KesifGirdi[],
  pozIndex: Record<string, Poz>,
): KesifOzet {
  const satirlar: KesifSatir[] = girdiler.map((g) => {
    const poz = pozIndex[g.pozKod];
    if (!poz) throw new Error(`Bilinmeyen poz kodu: ${g.pozKod}`);
    if (!Number.isFinite(g.miktar) || g.miktar <= 0) {
      throw new Error(`Geçersiz miktar (${g.pozKod}): ${g.miktar}`);
    }
    // Maliyet en düşük geçerli fiyatla hesaplanır
    return { ...g, poz, tutar: g.miktar * etkinFiyat(poz) };
  });

  const kategoriMap = new Map<string, number>();
  for (const s of satirlar) {
    kategoriMap.set(
      s.poz.kategori,
      (kategoriMap.get(s.poz.kategori) ?? 0) + s.tutar,
    );
  }

  return {
    satirlar,
    kategoriToplamlari: [...kategoriMap.entries()].map(
      ([kategori, tutar]) => ({ kategori, tutar }),
    ),
    genelToplam: satirlar.reduce((sum, s) => sum + s.tutar, 0),
  };
}
