import { describe, it, expect } from "vitest";
import { kesifOzeti } from "./kesif";
import type { Poz } from "@/lib/pozlar";

function poz(kod: string, ad: string, birim: string, resmiFiyat: number, kategori: string, extra?: Partial<Poz>): Poz {
  return {
    kod, ad, birim, resmiFiyat, kategori,
    kaynak: "ÇŞB", yil: 2026, sonGuncelleme: "2026-05-01T00:00:00Z",
    ...extra,
  };
}

const POZLAR: Record<string, Poz> = {
  "T.BETON": poz("T.BETON", "Beton", "m³", 5000, "Kaba Yapı"),
  "T.DEMIR": poz("T.DEMIR", "Demir", "kg", 40, "Kaba Yapı"),
  "T.BOYA": poz("T.BOYA", "Boya", "m²", 400, "İnce İşler"),
};

describe("kesifOzeti", () => {
  it("satır tutarı = miktar × poz fiyatı", () => {
    const o = kesifOzeti([{ pozKod: "T.BETON", miktar: 10 }], POZLAR);
    expect(o.satirlar[0].tutar).toBe(50_000);
    expect(o.genelToplam).toBe(50_000);
  });

  it("kategori toplamları doğru gruplanır ve genel toplama eşittir", () => {
    const o = kesifOzeti(
      [
        { pozKod: "T.BETON", miktar: 10 }, // 50.000 — Kaba Yapı
        { pozKod: "T.DEMIR", miktar: 1000 }, // 40.000 — Kaba Yapı
        { pozKod: "T.BOYA", miktar: 100 }, // 40.000 — İnce İşler
      ],
      POZLAR,
    );
    const kaba = o.kategoriToplamlari.find((k) => k.kategori === "Kaba Yapı");
    const ince = o.kategoriToplamlari.find((k) => k.kategori === "İnce İşler");
    expect(kaba?.tutar).toBe(90_000);
    expect(ince?.tutar).toBe(40_000);
    expect(o.genelToplam).toBe(130_000);
    const katSum = o.kategoriToplamlari.reduce((s, k) => s + k.tutar, 0);
    expect(katSum).toBe(o.genelToplam);
  });

  it("boş liste sıfır toplam döndürür", () => {
    const o = kesifOzeti([], POZLAR);
    expect(o.genelToplam).toBe(0);
    expect(o.kategoriToplamlari).toHaveLength(0);
  });

  it("bilinmeyen poz ve geçersiz miktar hata fırlatır", () => {
    expect(() => kesifOzeti([{ pozKod: "YOK", miktar: 1 }], POZLAR)).toThrow();
    expect(() => kesifOzeti([{ pozKod: "T.BOYA", miktar: 0 }], POZLAR)).toThrow();
    expect(() => kesifOzeti([{ pozKod: "T.BOYA", miktar: NaN }], POZLAR)).toThrow();
  });

  it("maliyet EN DÜŞÜK geçerli fiyatla hesaplanır (piyasa alt sınırı resmîden düşükse)", () => {
    const idx = {
      UCUZ: poz("UCUZ", "Beton", "m³", 5000, "Kaba Yapı", { piyasaMin: 4200, piyasaMax: 5800 }),
    };
    const o = kesifOzeti([{ pozKod: "UCUZ", miktar: 10 }], idx);
    expect(o.satirlar[0].tutar).toBe(42_000); // 10 × 4200 (resmî 5000 değil)
  });

  it("piyasa fiyatı resmîden yüksekse resmî fiyat kullanılır", () => {
    const idx = {
      PAHALI: poz("PAHALI", "Demir", "kg", 40, "Kaba Yapı", { piyasaMin: 45, piyasaMax: 52 }),
    };
    const o = kesifOzeti([{ pozKod: "PAHALI", miktar: 100 }], idx);
    expect(o.satirlar[0].tutar).toBe(4_000); // 100 × 40 (resmî, piyasaMin 45'ten düşük)
  });
});
