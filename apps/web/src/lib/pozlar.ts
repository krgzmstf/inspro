/* ──────────────────────────────────────────────────────────
   insPRO Poz Kütüphanesi — ÇOKLU KÜTÜPHANE

   İki bağımsız kütüphane:
   • kut1 → "POZ-KÜT-1"        (storage: inspro-pozlar-kut1)
   • kut2 → "Genel Poz Küt-2"  (storage: inspro-pozlar-v3 — mevcut)

   Her proje bir kütüphane seçer (project.pozKutuphane) ve hep
   onu kullanır. Tüm fonksiyonlar ilk parametre olarak libId alır.

   Her pozda iki fiyat: resmiFiyat (ÇŞB) + piyasaMin/Max (AI).
   Maliyet en düşük geçerli fiyatla hesaplanır (etkinFiyat).
   ────────────────────────────────────────────────────────── */

import { islemKaydet } from "./islemLog";

export const POZ_DATA_DATE = "ÇŞB 2026";
export const CSB_JSON_URL = "/data/csb-pozlar-2026.json";

/** Kütüphaneye gömülü statik tohum (ilk açılışta otomatik yüklenir).
    kut2 "TÜM POZLAR" → ÇŞB 2026 resmi birim fiyat listesi (~20 bin poz).
    2027 Ocak/Şubat'ta yeni liste gelince bu dosya + POZ_SEED_SURUM güncellenir. */
const SEED_URL: Partial<Record<string, string>> = {
  kut2: "/data/tum-pozlar-2026.json",
};

export type LibId = "kut1" | "kut2" | "kut3";
export const DEFAULT_LIB: LibId = "kut2";

/** Tüm kütüphaneler BOŞ başlar; pozlar Excel/CSV ile içe aktarılır veya elle eklenir. */
export const POZ_KUTUPHANELER: { id: LibId; ad: string; csb: boolean }[] = [
  { id: "kut1", ad: "POZ KÜTÜPHANESİ 1", csb: false },
  { id: "kut2", ad: "TÜM POZLAR", csb: false },
  { id: "kut3", ad: "ÖZEL POZ KÜTÜPHANESİ", csb: false },
];

export function pozKutuphaneAdi(id: string | undefined): string {
  return POZ_KUTUPHANELER.find((k) => k.id === id)?.ad ?? "TÜM POZLAR";
}
function isCsbLib(libId: LibId): boolean {
  return POZ_KUTUPHANELER.find((k) => k.id === libId)?.csb ?? true;
}

// v2: kütüphaneler boşaltıldı — eski (ÇŞB tohumlu) anahtarlar terk edildi.
const STORAGE_KEYS: Record<LibId, string> = {
  kut1: "inspro-pozlar-kut1-v2",
  kut2: "inspro-pozlar-kut2-2026", // ÇŞB 2026 tohumlu (yeni sürümde anahtarı değiştir)
  kut3: "inspro-pozlar-kut3-v2",
};
function storageKey(libId: LibId): string {
  return STORAGE_KEYS[libId] ?? STORAGE_KEYS[DEFAULT_LIB];
}

export type PozKaynak = "ÇŞB" | "KGM" | "DSİ" | "İLBANK" | "Piyasa" | "Özel";

export interface Poz {
  kod: string;
  ad: string;
  birim: string;
  kategori: string;
  kaynak: PozKaynak;
  yil: number;
  resmiFiyat: number;
  piyasaMin?: number;
  piyasaMax?: number;
  sonGuncelleme: string;
  piyasaGuncelleme?: string;
  guncellemeNotu?: string;
}

/** Maliyet için kullanılacak en düşük geçerli fiyat. */
export function etkinFiyat(p: Poz): number {
  const adaylar = [p.resmiFiyat, p.piyasaMin].filter(
    (v): v is number => typeof v === "number" && v > 0,
  );
  return adaylar.length ? Math.min(...adaylar) : p.resmiFiyat;
}

const FALLBACK: Poz[] = (
  [
    ["KB.001", "Hazır beton C30 (pompalı, yerine dökülmüş)", "m³", 4_950, "Kaba Yapı"],
    ["KB.002", "Nervürlü inşaat demiri (işçilik dahil)", "kg", 39, "Kaba Yapı"],
    ["II.002", "Saten alçı + plastik boya", "m²", 440, "İç İnce İşler"],
    ["DC.001", "Mantolama (5 cm EPS, file+sıva dahil)", "m²", 1_500, "Dış Cephe"],
  ] as const
).map(([kod, ad, birim, fiyat, kategori]) => ({
  kod, ad, birim, kategori,
  kaynak: "Piyasa" as PozKaynak,
  yil: 2026,
  resmiFiyat: fiyat,
  sonGuncelleme: new Date().toISOString(),
}));

interface CsbRow { kod: string; ad: string; birim: string; fiyat: number; kategori: string; }

interface SeedRow { kod: string; ad: string; birim: string; kategori: string; fiyat: number }

/** İlk açılışta ilgili kütüphaneyi hazırlar. Gömülü tohum (SEED_URL) varsa onu yükler. */
export async function ensurePozlarSeeded(libId: LibId = DEFAULT_LIB): Promise<Poz[]> {
  if (typeof window === "undefined") return FALLBACK;
  const mevcut = localStorage.getItem(storageKey(libId));
  if (mevcut !== null) {
    try {
      const parsed = JSON.parse(mevcut) as Poz[];
      // Tohumlu kütüphane boşalmışsa yeniden tohumla; değilse mevcut veriyi koru
      if (Array.isArray(parsed) && (parsed.length > 0 || !SEED_URL[libId])) return parsed;
    } catch { /* bozuk — yeniden hazırla */ }
  }
  // Gömülü statik tohum (ör. ÇŞB 2026 TÜM POZLAR)
  const seedUrl = SEED_URL[libId];
  if (seedUrl) {
    try {
      const res = await fetch(seedUrl);
      const rows = (await res.json()) as SeedRow[];
      const pozlar: Poz[] = rows.map((r) => ({
        kod: r.kod, ad: r.ad, birim: r.birim, kategori: r.kategori || "ÇŞB 2026",
        kaynak: "ÇŞB" as PozKaynak, yil: 2026, resmiFiyat: r.fiyat, sonGuncelleme: POZ_DATA_DATE,
      }));
      savePozlar(libId, pozlar);
      return pozlar;
    } catch { /* tohum yüklenemedi → boş bırak, kullanıcı içe aktarabilir */ }
  }
  // Kullanıcı kütüphanesi (Küt-3) boş başlar
  if (!isCsbLib(libId)) {
    savePozlar(libId, []);
    return [];
  }
  try {
    const res = await fetch(CSB_JSON_URL);
    const rows = (await res.json()) as CsbRow[];
    const ts = new Date().toISOString();
    const pozlar: Poz[] = rows.map((r) => ({
      kod: r.kod, ad: r.ad, birim: r.birim, kategori: r.kategori,
      kaynak: "ÇŞB", yil: 2026, resmiFiyat: r.fiyat, sonGuncelleme: ts,
    }));
    savePozlar(libId, pozlar);
    return pozlar;
  } catch {
    savePozlar(libId, FALLBACK);
    return FALLBACK;
  }
}

export function loadPozlar(libId: LibId = DEFAULT_LIB): Poz[] {
  if (typeof window === "undefined") return FALLBACK;
  try {
    const raw = localStorage.getItem(storageKey(libId));
    if (raw === null) return isCsbLib(libId) ? FALLBACK : [];
    const parsed = JSON.parse(raw) as Poz[];
    return Array.isArray(parsed) ? parsed : (isCsbLib(libId) ? FALLBACK : []);
  } catch {
    return isCsbLib(libId) ? FALLBACK : [];
  }
}

export function savePozlar(libId: LibId, pozlar: Poz[]) {
  try {
    localStorage.setItem(storageKey(libId), JSON.stringify(pozlar));
  } catch {
    // Quota aşımı (büyük kütüphane) → kalıcı yazılamadı; bellekte (state) devam eder.
  }
}

export function pozIndex(pozlar: Poz[]): Record<string, Poz> {
  return Object.fromEntries(pozlar.map((p) => [p.kod, p]));
}

export function pozKategoriler(pozlar: Poz[]): string[] {
  return [...new Set(pozlar.map((p) => p.kategori))];
}

export function updateResmiFiyat(libId: LibId, kod: string, yeniFiyat: number, not: string): Poz[] {
  const pozlar = loadPozlar(libId).map((p) =>
    p.kod === kod
      ? { ...p, resmiFiyat: yeniFiyat, sonGuncelleme: new Date().toISOString(), guncellemeNotu: not }
      : p,
  );
  savePozlar(libId, pozlar);
  islemKaydet("guncelle", "poz", kod, { yeniFiyat });
  return pozlar;
}

export function applyPiyasaFiyatlari(
  libId: LibId,
  guncellemeler: { kod: string; min: number; max: number; not: string }[],
): Poz[] {
  const harita = new Map(guncellemeler.map((g) => [g.kod, g]));
  const ts = new Date().toISOString();
  const pozlar = loadPozlar(libId).map((p) => {
    const g = harita.get(p.kod);
    return g
      ? { ...p, piyasaMin: g.min, piyasaMax: g.max, piyasaGuncelleme: ts, guncellemeNotu: g.not }
      : p;
  });
  savePozlar(libId, pozlar);
  return pozlar;
}

export function upsertPozlar(libId: LibId, yeniPozlar: Poz[]): Poz[] {
  const mevcut = loadPozlar(libId);
  const harita = new Map(mevcut.map((p) => [p.kod, p]));
  for (const p of yeniPozlar) {
    const eski = harita.get(p.kod);
    harita.set(p.kod, eski ? { ...p, piyasaMin: eski.piyasaMin, piyasaMax: eski.piyasaMax } : p);
  }
  const sonuc = [...harita.values()];
  savePozlar(libId, sonuc);
  islemKaydet("ice-aktar", "poz", pozKutuphaneAdi(libId), { eklenen: yeniPozlar.length });
  return sonuc;
}

/** Elle özel poz oluşturur (Küt-3 için). */
export function yeniOzelPoz(kod: string, ad: string, birim: string, kategori: string, fiyat: number): Poz {
  return {
    kod, ad, birim, kategori: kategori || "Özel",
    kaynak: "Özel", yil: new Date().getFullYear(),
    resmiFiyat: fiyat, sonGuncelleme: new Date().toISOString(),
    guncellemeNotu: "Elle eklendi",
  };
}

export function deletePoz(libId: LibId, kod: string): Poz[] {
  const pozlar = loadPozlar(libId).filter((p) => p.kod !== kod);
  savePozlar(libId, pozlar);
  islemKaydet("sil", "poz", kod, { kutuphane: pozKutuphaneAdi(libId) });
  return pozlar;
}

export async function resetPozlar(libId: LibId): Promise<Poz[]> {
  if (typeof window !== "undefined") localStorage.removeItem(storageKey(libId));
  return ensurePozlarSeeded(libId);
}
