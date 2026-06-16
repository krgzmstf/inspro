/* ──────────────────────────────────────────────────────────
   insPRO — Teklif (proposal) veri katmanı

   Projenin keşfinden müşteriye teklif belgesi üretir. Baz fiyat
   (ÇŞB / piyasa / kendi) + kâr marjı ile kalemler oluşturulur,
   düzenlenir; ara toplam + KDV + genel toplam hesaplanır.

   Geçici: localStorage.
   ────────────────────────────────────────────────────────── */

export type TeklifBaz = "csb" | "piyasa" | "kendi" | "manuel";

export interface TeklifKalem {
  id: string;
  aciklama: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
}

export interface Teklif {
  id: string;
  projectId: string;
  no: string;
  tarih: string;        // ISO gün
  gecerlilikGun: number;
  musteriAd: string;
  musteriFirma: string;
  musteriAdres: string;
  musteriTel: string;
  baz: TeklifBaz;
  karMarji: number;     // %
  kdvOran: number;      // %
  kalemler: TeklifKalem[];
  sartlar: string;
  not: string;
  createdAt: string;
}

const STORAGE_KEY = "inspro-teklif";

function loadAll(): Teklif[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveAll(list: Teklif[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); void import("./genelSenkron").then((m) => m.modulYaz("teklif")); }

export function loadTeklifler(projectId: string): Teklif[] {
  return loadAll().filter((t) => t.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function yeniTeklif(projectId: string): Teklif {
  const yil = new Date().getFullYear();
  const sira = loadAll().length + 1;
  return {
    id: crypto.randomUUID(), projectId,
    no: `TKL-${yil}-${String(sira).padStart(3, "0")}`,
    tarih: new Date().toISOString().slice(0, 10),
    gecerlilikGun: 15,
    musteriAd: "", musteriFirma: "", musteriAdres: "", musteriTel: "",
    baz: "piyasa", karMarji: 15, kdvOran: 20,
    kalemler: [],
    sartlar: "Fiyatlara KDV dahil değildir. Ödeme: hakediş esaslı. Teklif geçerlilik süresi içinde yapılan başvurularda geçerlidir.",
    not: "",
    createdAt: new Date().toISOString(),
  };
}

export function saveTeklif(t: Teklif) {
  const list = loadAll();
  const i = list.findIndex((x) => x.id === t.id);
  if (i >= 0) list[i] = t; else list.push(t);
  saveAll(list);
}

export function deleteTeklif(id: string) {
  saveAll(loadAll().filter((t) => t.id !== id));
}

export interface TeklifToplam {
  araToplam: number;
  kdv: number;
  genelToplam: number;
}

export function teklifToplam(t: Teklif): TeklifToplam {
  const araToplam = t.kalemler.reduce((s, k) => s + k.miktar * k.birimFiyat, 0);
  const kdv = araToplam * (t.kdvOran / 100);
  return { araToplam, kdv, genelToplam: araToplam + kdv };
}
