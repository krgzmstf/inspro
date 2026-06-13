/* ──────────────────────────────────────────────────────────
   insPRO — Saha Takibi (gelişmiş) veri katmanı

   Kayıt türleri: ilerleme notu · iş emri (görev) · kusur (punch
   list) · malzeme talebi. Her kayıt: kat/bölüm, imalat kategorisi,
   öncelik, sorumlu, termin, çoklu fotoğraf, durum ve yorum akışı.

   Geçici: localStorage. Fotoğraflar küçültülmüş thumbnail.
   ────────────────────────────────────────────────────────── */

export type SahaTip = "ilerleme" | "isemri" | "kusur" | "malzeme";
export type SahaOncelik = "dusuk" | "orta" | "yuksek" | "acil";
export type SahaDurum = "acik" | "devam" | "tamam";

export const SAHA_TIP: Record<SahaTip, { label: string; icon: string; renk: string }> = {
  ilerleme: { label: "İlerleme", icon: "📈", renk: "bg-sky-100 text-sky-700" },
  isemri: { label: "İş Emri", icon: "📋", renk: "bg-indigo-100 text-indigo-700" },
  kusur: { label: "Kusur / Eksik", icon: "⚠️", renk: "bg-red-100 text-red-700" },
  malzeme: { label: "Malzeme Talebi", icon: "📦", renk: "bg-amber-100 text-amber-700" },
};

export const SAHA_ONCELIK: Record<SahaOncelik, { label: string; renk: string }> = {
  dusuk: { label: "Düşük", renk: "bg-slate-100 text-slate-500" },
  orta: { label: "Orta", renk: "bg-sky-100 text-sky-600" },
  yuksek: { label: "Yüksek", renk: "bg-amber-100 text-amber-700" },
  acil: { label: "Acil", renk: "bg-red-100 text-red-700" },
};

export const SAHA_DURUM: Record<SahaDurum, { label: string; renk: string }> = {
  acik: { label: "Açık", renk: "bg-slate-200 text-slate-600" },
  devam: { label: "Devam Ediyor", renk: "bg-brand-500/15 text-brand-600" },
  tamam: { label: "Tamamlandı", renk: "bg-emerald-100 text-emerald-700" },
};

export const IMALAT_KATEGORILERI = [
  "Kazı", "Temel", "Demir", "Kalıp", "Beton", "Duvar", "Şap", "Sıva", "Alçı",
  "Boya", "Seramik / Fayans", "Mekanik Tesisat", "Elektrik", "Çatı",
  "Dış Cephe / Mantolama", "Doğrama / Cam", "İnce İş", "Çevre", "Genel",
];

export interface SahaYorum {
  id: string;
  kisi: string;
  metin: string;
  tarih: string;
}

export interface SahaKaydi {
  id: string;
  projectId: string;
  tip: SahaTip;
  baslik: string;
  aciklama: string;
  kat: string;          // ilgili kat/bölüm
  imalat: string;       // imalat kategorisi
  oncelik: SahaOncelik;
  sorumlu: string;      // atanan kişi
  termin: string;       // ISO gün (iş emri için) | ""
  durum: SahaDurum;
  fotograflar: string[]; // thumbnail data URL listesi
  kisi: string;         // kaydı giren
  tarih: string;        // ISO
  yorumlar: SahaYorum[];
}

const STORAGE_KEY = "inspro-saha";

function loadAll(): SahaKaydi[] {
  if (typeof window === "undefined") return [];
  try {
    const ham = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return (ham as unknown[]).map(normalize);
  } catch {
    return [];
  }
}

/** Eski/eksik kayıtları yeni şemaya normalize eder (geriye dönük). */
function normalize(x: unknown): SahaKaydi {
  const r = x as Record<string, unknown>;
  const eskiDurum = r.durum as string;
  const durum: SahaDurum =
    eskiDurum === "onay" || eskiDurum === "tamam" ? "tamam"
    : eskiDurum === "devam" ? "devam" : "acik";
  return {
    id: String(r.id ?? crypto.randomUUID()),
    projectId: String(r.projectId ?? ""),
    tip: (["ilerleme", "isemri", "kusur", "malzeme"].includes(r.tip as string) ? r.tip : "ilerleme") as SahaTip,
    baslik: String(r.baslik ?? ""),
    aciklama: String(r.aciklama ?? ""),
    kat: String(r.kat ?? ""),
    imalat: String(r.imalat ?? "Genel"),
    oncelik: (["dusuk", "orta", "yuksek", "acil"].includes(r.oncelik as string) ? r.oncelik : "orta") as SahaOncelik,
    sorumlu: String(r.sorumlu ?? ""),
    termin: String(r.termin ?? ""),
    durum,
    fotograflar: Array.isArray(r.fotograflar) ? (r.fotograflar as string[]) : (r.foto ? [String(r.foto)] : []),
    kisi: String(r.kisi ?? "Saha"),
    tarih: String(r.tarih ?? new Date().toISOString()),
    yorumlar: Array.isArray(r.yorumlar) ? (r.yorumlar as SahaYorum[]) : [],
  };
}

function saveAll(kayitlar: SahaKaydi[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kayitlar));
}

export function loadSaha(projectId: string): SahaKaydi[] {
  return loadAll()
    .filter((k) => k.projectId === projectId)
    .sort((a, b) => b.tarih.localeCompare(a.tarih));
}

export function addSaha(data: Omit<SahaKaydi, "id" | "tarih" | "yorumlar">): SahaKaydi {
  const kayit: SahaKaydi = { ...data, id: crypto.randomUUID(), tarih: new Date().toISOString(), yorumlar: [] };
  saveAll([kayit, ...loadAll()]);
  return kayit;
}

export function updateSaha(id: string, patch: Partial<SahaKaydi>) {
  saveAll(loadAll().map((k) => (k.id === id ? { ...k, ...patch } : k)));
}

export function addYorum(id: string, kisi: string, metin: string) {
  saveAll(loadAll().map((k) => k.id === id
    ? { ...k, yorumlar: [...k.yorumlar, { id: crypto.randomUUID(), kisi: kisi || "Kullanıcı", metin, tarih: new Date().toISOString() }] }
    : k));
}

export function deleteSaha(id: string) {
  saveAll(loadAll().filter((k) => k.id !== id));
}

/** Fotoğrafı tarayıcıda küçültüp data URL döndürür. */
export function fotoKucult(file: File, maxBoyut = 640, kalite = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Görsel açılamadı"));
      img.onload = () => {
        const oran = Math.min(1, maxBoyut / Math.max(img.width, img.height));
        const w = Math.round(img.width * oran), h = Math.round(img.height * oran);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas desteklenmiyor"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", kalite));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
