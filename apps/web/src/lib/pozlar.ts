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

export const POZ_DATA_DATE = "Mayıs 2026";
export const CSB_JSON_URL = "/data/csb-pozlar-2026.json";

export type LibId = "kut1" | "kut2" | "kut3";
export const DEFAULT_LIB: LibId = "kut2";

/** csb=true: boşsa ÇŞB setinden tohumlanır. csb=false: kullanıcı kütüphanesi (boş başlar). */
export const POZ_KUTUPHANELER: { id: LibId; ad: string; csb: boolean }[] = [
  { id: "kut1", ad: "POZ-KÜT-1", csb: true },
  { id: "kut2", ad: "Genel Poz Küt-2", csb: true },
  { id: "kut3", ad: "Küt-3 (Özelim)", csb: false },
];

export function pozKutuphaneAdi(id: string | undefined): string {
  return POZ_KUTUPHANELER.find((k) => k.id === id)?.ad ?? "Genel Poz Küt-2";
}
function isCsbLib(libId: LibId): boolean {
  return POZ_KUTUPHANELER.find((k) => k.id === libId)?.csb ?? true;
}

const STORAGE_KEYS: Record<LibId, string> = {
  kut1: "inspro-pozlar-kut1",
  kut2: "inspro-pozlar-v3",
  kut3: "inspro-pozlar-kut3",
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

/** İlk açılışta ilgili kütüphaneyi hazırlar. csb=false ise boş başlatır. */
export async function ensurePozlarSeeded(libId: LibId = DEFAULT_LIB): Promise<Poz[]> {
  if (typeof window === "undefined") return FALLBACK;
  const mevcut = localStorage.getItem(storageKey(libId));
  if (mevcut !== null) {
    try {
      const parsed = JSON.parse(mevcut) as Poz[];
      if (Array.isArray(parsed)) return parsed; // boş kullanıcı kütüphanesi de geçerli
    } catch { /* bozuk — yeniden hazırla */ }
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
  localStorage.setItem(storageKey(libId), JSON.stringify(pozlar));
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
  return pozlar;
}

export async function resetPozlar(libId: LibId): Promise<Poz[]> {
  if (typeof window !== "undefined") localStorage.removeItem(storageKey(libId));
  return ensurePozlarSeeded(libId);
}
