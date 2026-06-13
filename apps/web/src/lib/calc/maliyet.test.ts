import { describe, it, expect } from "vitest";
import {
  estimateCost,
  floorFactor,
  BREAKDOWN,
  UNIT_PRICES,
  CITY_MULTIPLIERS,
} from "./maliyet";

const BASE = {
  area: 300,
  floors: 1,
  type: "konut" as const,
  quality: "standart" as const,
  city: "Diğer",
};

describe("estimateCost", () => {
  it("toplam = birim × alan (alan kat sayısıyla TEKRAR çarpılmaz)", () => {
    // İncelenen projelerdeki çift-çarpım hatasının regresyon testi:
    // 300 m² toplam alan, 3 kat → maliyet 3 katına ÇIKMAMALI;
    // yalnızca küçük kat zorluk primi (%3) uygulanmalı.
    const tek = estimateCost({ ...BASE, floors: 1 });
    const uc = estimateCost({ ...BASE, floors: 3 });

    expect(uc.totalAvg / tek.totalAvg).toBeCloseTo(floorFactor(3), 10);
    expect(uc.totalAvg / tek.totalAvg).toBeLessThan(1.1); // asla ~3x değil

    expect(tek.totalMin).toBeCloseTo(tek.unitMin * BASE.area, 6);
    expect(tek.totalMax).toBeCloseTo(tek.unitMax * BASE.area, 6);
  });

  it("birim fiyat çarpanları doğru uygulanır", () => {
    const r = estimateCost({
      area: 100,
      floors: 1,
      type: "villa",
      quality: "ekonomik",
      city: "İstanbul",
    });
    const beklenen =
      UNIT_PRICES.ekonomik.min * 1.15 * CITY_MULTIPLIERS["İstanbul"];
    expect(r.unitMin).toBeCloseTo(beklenen, 6);
  });

  it("bilinmeyen şehir 'Diğer' çarpanına düşer", () => {
    const bilinmeyen = estimateCost({ ...BASE, city: "Atlantis" });
    const diger = estimateCost({ ...BASE, city: "Diğer" });
    expect(bilinmeyen.totalAvg).toBe(diger.totalAvg);
  });

  it("kalem dağılımı %100'e ve toplam tutara eşittir", () => {
    const pctSum = BREAKDOWN.reduce((s, b) => s + b.pct, 0);
    expect(pctSum).toBe(100);

    const r = estimateCost(BASE);
    const amountSum = r.breakdown.reduce((s, b) => s + b.amount, 0);
    expect(amountSum).toBeCloseTo(r.totalAvg, 4);
  });

  it("geçersiz girdiler hata fırlatır", () => {
    expect(() => estimateCost({ ...BASE, area: 0 })).toThrow();
    expect(() => estimateCost({ ...BASE, area: -5 })).toThrow();
    expect(() => estimateCost({ ...BASE, area: NaN })).toThrow();
    expect(() => estimateCost({ ...BASE, floors: 0 })).toThrow();
  });

  it("kat çarpanı 20 katta sınırlanır", () => {
    expect(floorFactor(20)).toBe(floorFactor(45));
    expect(floorFactor(1)).toBe(1);
  });
});
