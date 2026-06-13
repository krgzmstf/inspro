/* ──────────────────────────────────────────────────────────
   insPRO Hesap Motoru — Hızlı Maliyet Tahmini (m² bazlı)

   KURAL: `area` parametresi TÜM KATLAR DAHİL toplam inşaat
   alanıdır ve asla kat sayısıyla tekrar çarpılmaz. Kat sayısı
   yalnızca küçük bir zorluk çarpanı (yükseklik primi) ekler.
   (İncelenen projelerdeki çift-çarpım hatasının önlemi;
   bkz. maliyet.test.ts)
   ────────────────────────────────────────────────────────── */

import type { ProjectType } from "@/lib/projects";

export type Quality = "ekonomik" | "standart" | "luks";

/** Fiyat verisinin geçerlilik damgası — UI'da gösterilir. */
export const PRICE_DATA_DATE = "Haziran 2026";

/** Anahtar teslim yapım maliyeti birim fiyat aralıkları (₺/m²). */
export const UNIT_PRICES: Record<Quality, { min: number; max: number }> = {
  ekonomik: { min: 19_000, max: 26_000 },
  standart: { min: 30_000, max: 42_000 },
  luks: { min: 52_000, max: 75_000 },
};

export const QUALITY_LABELS: Record<Quality, string> = {
  ekonomik: "Ekonomik",
  standart: "Standart",
  luks: "Lüks",
};

export const TYPE_MULTIPLIERS: Record<ProjectType, number> = {
  konut: 1.0,
  villa: 1.15,
  ticari: 1.1,
};

export const CITY_MULTIPLIERS: Record<string, number> = {
  İstanbul: 1.2,
  Ankara: 1.05,
  İzmir: 1.1,
  Bursa: 1.04,
  Antalya: 1.08,
  Adana: 0.95,
  Konya: 0.93,
  Gaziantep: 0.94,
  Trabzon: 0.97,
  Muğla: 1.1,
  Kayseri: 0.94,
  Samsun: 0.96,
  Diğer: 1.0,
};

/**
 * Kat sayısı zorluk çarpanı: her ilave kat %1,5 prim, 20 katta
 * sınırlanır. (Alan zaten toplam olduğu için bu çarpan KÜÇÜKTÜR.)
 */
export function floorFactor(floors: number): number {
  const f = Math.min(Math.max(Math.trunc(floors), 1), 20);
  return 1 + (f - 1) * 0.015;
}

/** Maliyet kalemi dağılımı — toplamı %100. */
export const BREAKDOWN: { name: string; pct: number }[] = [
  { name: "Kazı, İksa & Temel", pct: 8 },
  { name: "Kaba Yapı (beton · demir · kalıp)", pct: 30 },
  { name: "Duvarlar & Şap", pct: 5 },
  { name: "Çatı", pct: 4 },
  { name: "Mekanik Tesisat", pct: 9 },
  { name: "Elektrik Tesisatı", pct: 6 },
  { name: "İç İnce İşler (alçı · boya · zemin)", pct: 18 },
  { name: "Doğrama & Cam", pct: 7 },
  { name: "Dış Cephe & Yalıtım", pct: 8 },
  { name: "Çevre Düzenleme & Şantiye Genel", pct: 5 },
];

export interface EstimateInput {
  /** Tüm katlar dahil toplam inşaat alanı (m²). */
  area: number;
  floors: number;
  type: ProjectType;
  quality: Quality;
  city: string;
}

export interface EstimateResult {
  unitMin: number;
  unitMax: number;
  unitAvg: number;
  totalMin: number;
  totalMax: number;
  totalAvg: number;
  multipliers: { type: number; city: number; floor: number };
  breakdown: { name: string; pct: number; amount: number }[];
}

export function estimateCost(input: EstimateInput): EstimateResult {
  if (!Number.isFinite(input.area) || input.area <= 0) {
    throw new Error("Alan 0'dan büyük olmalıdır.");
  }
  if (!Number.isFinite(input.floors) || input.floors < 1) {
    throw new Error("Kat sayısı en az 1 olmalıdır.");
  }

  const base = UNIT_PRICES[input.quality];
  const tm = TYPE_MULTIPLIERS[input.type];
  const cm = CITY_MULTIPLIERS[input.city] ?? CITY_MULTIPLIERS["Diğer"];
  const ff = floorFactor(input.floors);

  const unitMin = base.min * tm * cm * ff;
  const unitMax = base.max * tm * cm * ff;
  const unitAvg = (unitMin + unitMax) / 2;

  // Alan zaten toplam — kat sayısıyla ÇARPILMAZ.
  const totalMin = unitMin * input.area;
  const totalMax = unitMax * input.area;
  const totalAvg = (totalMin + totalMax) / 2;

  return {
    unitMin,
    unitMax,
    unitAvg,
    totalMin,
    totalMax,
    totalAvg,
    multipliers: { type: tm, city: cm, floor: ff },
    breakdown: BREAKDOWN.map((b) => ({
      ...b,
      amount: (totalAvg * b.pct) / 100,
    })),
  };
}
