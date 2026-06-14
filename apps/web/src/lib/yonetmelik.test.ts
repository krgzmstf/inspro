import { describe, it, expect } from "vitest";
import { yonetmelikAra } from "./yonetmelik";

describe("yonetmelikAra (hafif RAG)", () => {
  it("pas payı sorgusunda doğru maddeyi en üstte döndürür", () => {
    const r = yonetmelikAra("betonarme pas payı kaç mm");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].id).toBe("betonarme-paspayi");
    expect(r[0].kaynak).toContain("TS 500");
  });

  it("Türkçe karakter/normalizasyon farkına dayanıklıdır", () => {
    const r = yonetmelikAra("cekme mesafesi"); // 'çekme' yerine ascii
    expect(r.some((k) => k.id === "imar-cekme-mesafe")).toBe(true);
  });

  it("ilgisiz sorguda boş döner", () => {
    expect(yonetmelikAra("zürafa pizza tarifi")).toHaveLength(0);
  });

  it("adet sınırına uyar", () => {
    const r = yonetmelikAra("yapı beton imar yangın deprem otopark", 2);
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it("skora göre sıralıdır (azalan)", () => {
    const r = yonetmelikAra("yangın merdiveni kaçış");
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].skor).toBeGreaterThanOrEqual(r[i].skor);
    }
  });
});
