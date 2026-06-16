/* ──────────────────────────────────────────────────────────
   insPRO — Hakediş (taşeron istihkak / progress payment)

   Sözleşme kalemleri (keşiften) üzerinden dönemsel ödeme:
   her hakedişte kümülatif imalat girilir, önceki hakedişin
   kümülatifi düşülerek "bu dönem" bulunur. Teminat, stopaj,
   avans mahsubu ve KDV ile net ödeme hesaplanır.

   Geçici: localStorage.
   ────────────────────────────────────────────────────────── */

export interface HakedisKalem {
  id: string;
  aciklama: string;
  birim: string;
  sozlesmeMiktar: number; // sözleşmedeki toplam imalat
  birimFiyat: number;
  kumulatifMiktar: number; // bu hakedişe kadar (dahil) yapılan toplam
  oncekiKumulatif: number; // önceki hakedişteki kümülatif (snapshot)
}

export interface Hakedis {
  id: string;
  projectId: string;
  no: number;
  tarih: string; // ISO gün
  taseron: string;
  teminatOran: number; // %
  stopajOran: number;  // %
  kdvOran: number;     // %
  avansMahsup: number; // bu dönem mahsup edilen avans (TL)
  kalemler: HakedisKalem[];
  not: string;
  createdAt: string;
}

const STORAGE_KEY = "inspro-hakedis";

function loadAll(): Hakedis[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveAll(list: Hakedis[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); void import("./genelSenkron").then((m) => m.modulYaz("hakedis")); }

export function loadHakedisler(projectId: string): Hakedis[] {
  return loadAll().filter((h) => h.projectId === projectId).sort((a, b) => a.no - b.no);
}

/** Yeni hakediş: önceki hakediş varsa kalemleri devreder (kümülatif → önceki kümülatif). */
export function yeniHakedis(projectId: string): Hakedis {
  const mevcut = loadHakedisler(projectId);
  const onceki = mevcut[mevcut.length - 1];
  const kalemler: HakedisKalem[] = onceki
    ? onceki.kalemler.map((k) => ({
        ...k,
        id: crypto.randomUUID(),
        oncekiKumulatif: k.kumulatifMiktar, // önceki dönemin kümülatifi taban olur
      }))
    : [];
  return {
    id: crypto.randomUUID(), projectId,
    no: (onceki?.no ?? 0) + 1,
    tarih: new Date().toISOString().slice(0, 10),
    taseron: onceki?.taseron ?? "",
    teminatOran: onceki?.teminatOran ?? 5,
    stopajOran: onceki?.stopajOran ?? 0,
    kdvOran: onceki?.kdvOran ?? 20,
    avansMahsup: 0,
    kalemler,
    not: "",
    createdAt: new Date().toISOString(),
  };
}

export function saveHakedis(h: Hakedis) {
  const list = loadAll();
  const i = list.findIndex((x) => x.id === h.id);
  if (i >= 0) list[i] = h; else list.push(h);
  saveAll(list);
}

export function deleteHakedis(id: string) {
  saveAll(loadAll().filter((h) => h.id !== id));
}

/** Bir tekliften (kabul edilen) hakediş sözleşme kalemleri üretir.
   Sözleşme bedeli = teklifte müşterinin onayladığı birim fiyatlar. */
export function hakedisKalemleriTekliften(
  kalemler: { aciklama: string; miktar: number; birim: string; birimFiyat: number }[],
): HakedisKalem[] {
  return kalemler.map((k) => ({
    id: crypto.randomUUID(),
    aciklama: k.aciklama,
    birim: k.birim,
    sozlesmeMiktar: k.miktar,
    birimFiyat: Math.round(k.birimFiyat),
    kumulatifMiktar: 0,
    oncekiKumulatif: 0,
  }));
}

export interface HakedisKalemHesap extends HakedisKalem {
  buDonemMiktar: number;
  sozlesmeTutar: number;
  kumulatifTutar: number;
  oncekiTutar: number;
  buDonemTutar: number;
  ilerlemeYuzde: number; // kümülatif / sözleşme
}

export interface HakedisToplam {
  sozlesme: number;
  kumulatif: number;
  onceki: number;
  buDonemBrut: number;
  kdv: number;
  teminat: number;
  stopaj: number;
  avans: number;
  netOdeme: number;
  genelIlerleme: number; // % kümülatif/sözleşme
}

export function hakedisHesapla(h: Hakedis): { kalemler: HakedisKalemHesap[]; toplam: HakedisToplam } {
  const kalemler: HakedisKalemHesap[] = h.kalemler.map((k) => {
    const buDonemMiktar = k.kumulatifMiktar - k.oncekiKumulatif;
    return {
      ...k,
      buDonemMiktar,
      sozlesmeTutar: k.sozlesmeMiktar * k.birimFiyat,
      kumulatifTutar: k.kumulatifMiktar * k.birimFiyat,
      oncekiTutar: k.oncekiKumulatif * k.birimFiyat,
      buDonemTutar: buDonemMiktar * k.birimFiyat,
      ilerlemeYuzde: k.sozlesmeMiktar > 0 ? (k.kumulatifMiktar / k.sozlesmeMiktar) * 100 : 0,
    };
  });
  const sozlesme = kalemler.reduce((s, k) => s + k.sozlesmeTutar, 0);
  const kumulatif = kalemler.reduce((s, k) => s + k.kumulatifTutar, 0);
  const onceki = kalemler.reduce((s, k) => s + k.oncekiTutar, 0);
  const buDonemBrut = kumulatif - onceki;
  const kdv = buDonemBrut * (h.kdvOran / 100);
  const teminat = buDonemBrut * (h.teminatOran / 100);
  const stopaj = buDonemBrut * (h.stopajOran / 100);
  const avans = h.avansMahsup || 0;
  return {
    kalemler,
    toplam: {
      sozlesme, kumulatif, onceki, buDonemBrut, kdv, teminat, stopaj, avans,
      netOdeme: buDonemBrut + kdv - teminat - stopaj - avans,
      genelIlerleme: sozlesme > 0 ? (kumulatif / sozlesme) * 100 : 0,
    },
  };
}
