/* ──────────────────────────────────────────────────────────
   insPRO — Firma / Cari Rehberi (PROJE-ÜSTÜ, merkezi)

   Taşeron, tedarikçi, müşteri, danışman vb. tüm firmalar tek
   yerde. Programın her yerindeki isim alanları (muhasebe taraf,
   hakediş taşeron, aşama kalem kişi…) bu rehberden beslenir;
   yeni yazılan isimler otomatik buraya kaydolur (firmaYakala).

   Kişiler (çalışan/taşeron ustası vb.) Personel modülünde tutulur
   (bkz. personel.ts); rehber ikisini birleştirir → isimOnerileri().

   Geçici: localStorage. Supabase'e geçişte tek bu katman döner.
   ────────────────────────────────────────────────────────── */

import { loadPersonel } from "./personel";
import { loadProjects } from "./projects";

export type FirmaTip = "taseron" | "tedarikci" | "musteri" | "danisman" | "diger";

export const FIRMA_TIP_LABEL: Record<FirmaTip, string> = {
  taseron: "Taşeron", tedarikci: "Tedarikçi", musteri: "Müşteri",
  danisman: "Danışman / Müellif", diger: "Diğer",
};

export interface Firma {
  id: string;
  ad: string;            // firma ünvanı
  tip: FirmaTip;
  yetkili: string;       // sahibi / yetkili kişi
  telefon: string;
  email: string;
  vergiDairesi: string;
  vergiNo: string;
  iban: string;
  adres: string;
  girisKullanici: string; // program giriş bilgisi (ileride Auth)
  girisSifre: string;
  calisanlar: string[];   // bağlı çalışan/kişi adları
  not: string;
  aktif: boolean;
  createdAt: string;
}

const STORAGE_KEY = "inspro-firma";

export function loadFirmalar(): Firma[] {
  if (typeof window === "undefined") return [];
  try {
    const list: Firma[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return list.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  } catch {
    return [];
  }
}

function saveAll(list: Firma[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  void import("./genelSenkron").then((m) => m.modulYaz("firma"));
}

export function bosFirma(): Firma {
  return {
    id: crypto.randomUUID(), ad: "", tip: "taseron", yetkili: "",
    telefon: "", email: "", vergiDairesi: "", vergiNo: "", iban: "", adres: "",
    girisKullanici: "", girisSifre: "", calisanlar: [], not: "", aktif: true,
    createdAt: new Date().toISOString(),
  };
}

export function saveFirma(f: Firma) {
  const list = loadFirmalar();
  const i = list.findIndex((x) => x.id === f.id);
  if (i >= 0) list[i] = f; else list.push(f);
  saveAll(list);
}

export function deleteFirma(id: string) {
  saveAll(loadFirmalar().filter((f) => f.id !== id));
}

export function getFirma(id: string): Firma | undefined {
  return loadFirmalar().find((f) => f.id === id);
}

const norm = (s: string) => s.trim().toLocaleLowerCase("tr");

/** Programın herhangi bir yerinde yazılan ismi rehbere yakalar (yoksa ekler).
   Var olan firma/personel adıyla eşleşirse tekrar eklemez. */
export function firmaYakala(ad: string, tip: FirmaTip = "diger"): Firma | undefined {
  const temiz = ad.trim();
  if (!temiz) return undefined;
  const n = norm(temiz);
  if (loadFirmalar().some((f) => norm(f.ad) === n)) return undefined;
  // Personelde aynı isim varsa firma olarak ekleme (kişi zaten kayıtlı)
  for (const p of loadProjects()) {
    if (loadPersonel(p.id).some((x) => norm(`${x.ad} ${x.soyad}`) === n)) return undefined;
  }
  const f = { ...bosFirma(), ad: temiz, tip };
  saveFirma(f);
  return f;
}

export interface IsimOneri { ad: string; etiket: string }

/** Tüm rehber isimleri (firmalar + tüm projelerdeki personel) — autocomplete için. */
export function isimOnerileri(): IsimOneri[] {
  const out: IsimOneri[] = [];
  const gorulen = new Set<string>();
  const ekle = (ad: string, etiket: string) => {
    const t = ad.trim();
    if (!t) return;
    const n = norm(t);
    if (gorulen.has(n)) return;
    gorulen.add(n);
    out.push({ ad: t, etiket });
  };
  for (const f of loadFirmalar()) ekle(f.ad, FIRMA_TIP_LABEL[f.tip]);
  for (const p of loadProjects()) {
    for (const k of loadPersonel(p.id)) ekle(`${k.ad} ${k.soyad}`.trim(), k.gorev || "Personel");
  }
  return out.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}
