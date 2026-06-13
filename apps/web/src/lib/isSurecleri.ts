/* ──────────────────────────────────────────────────────────
   insPRO — İş Süreçleri (iş programı / Gantt) veri katmanı

   Proje iş kalemlerini tarih + ilerleme ile takip eder.
   Boşsa projenin 13 aşamalı yol haritasından (PHASE_NAMES)
   varsayılan iş programı oluşturulur; aşama durumundan
   ilerleme türetilir.

   Geçici: localStorage.
   ────────────────────────────────────────────────────────── */

import { PHASE_NAMES, getProject } from "@/lib/projects";

export interface IsKalemi {
  id: string;
  projectId: string;
  ad: string;
  grup: string;        // kat / blok / imalat grubu
  sorumlu: string;
  baslangic: string;   // ISO gün (YYYY-MM-DD) | ""
  bitis: string;       // ISO gün | ""
  ilerleme: number;    // 0-100
  oncekiler?: string[]; // önce bitmesi gereken iş kalemlerinin id'leri (bağımlılık)
}

const STORAGE_KEY = "inspro-issurecleri";

function loadAll(): IsKalemi[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAll(kalemler: IsKalemi[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kalemler));
}

function gunEkle(tarih: Date, gun: number): string {
  const d = new Date(tarih);
  d.setDate(d.getDate() + gun);
  return d.toISOString().slice(0, 10);
}

/** Projenin iş kalemlerini döndürür; yoksa yol haritasından tohumlar. */
export function loadIsSurecleri(projectId: string): IsKalemi[] {
  const mevcut = loadAll().filter((k) => k.projectId === projectId);
  if (mevcut.length) return siralaTarih(mevcut);

  // Tohumla: 13 aşama, sıralı 2'şer haftalık; her aşama bir öncekine bağlı (zincir)
  const proje = getProject(projectId);
  const bugun = new Date();
  const idler = PHASE_NAMES.map(() => crypto.randomUUID());
  const yeni: IsKalemi[] = PHASE_NAMES.map((ad, i) => {
    const faz = proje?.phases.find((p) => p.name === ad);
    const ilerleme = faz?.status === "tamam" ? 100 : faz?.status === "devam" ? 50 : 0;
    return {
      id: idler[i],
      projectId,
      ad,
      grup: "Genel",
      sorumlu: "",
      baslangic: gunEkle(bugun, i * 14),
      bitis: gunEkle(bugun, i * 14 + 13),
      ilerleme,
      oncekiler: i > 0 ? [idler[i - 1]] : [],
    };
  });
  saveAll([...loadAll(), ...yeni]);
  return yeni;
}

function siralaTarih(k: IsKalemi[]): IsKalemi[] {
  return [...k].sort((a, b) => (a.baslangic || "9999").localeCompare(b.baslangic || "9999"));
}

export function addIsKalemi(data: Omit<IsKalemi, "id">): IsKalemi {
  const kalem: IsKalemi = { ...data, id: crypto.randomUUID() };
  saveAll([...loadAll(), kalem]);
  return kalem;
}

export function updateIsKalemi(id: string, patch: Partial<IsKalemi>) {
  saveAll(loadAll().map((k) => (k.id === id ? { ...k, ...patch } : k)));
}

export function deleteIsKalemi(id: string) {
  saveAll(loadAll().filter((k) => k.id !== id));
}

export interface IsOzet {
  genelIlerleme: number;
  toplam: number;
  tamamlanan: number;
  geciken: number;     // bitiş geçmiş ama %100 değil
}

export function isOzeti(kalemler: IsKalemi[]): IsOzet {
  if (kalemler.length === 0) return { genelIlerleme: 0, toplam: 0, tamamlanan: 0, geciken: 0 };
  const bugun = new Date().toISOString().slice(0, 10);
  let toplamIlerleme = 0, tamamlanan = 0, geciken = 0;
  for (const k of kalemler) {
    toplamIlerleme += k.ilerleme;
    if (k.ilerleme >= 100) tamamlanan++;
    if (k.bitis && k.bitis < bugun && k.ilerleme < 100) geciken++;
  }
  return {
    genelIlerleme: Math.round(toplamIlerleme / kalemler.length),
    toplam: kalemler.length,
    tamamlanan,
    geciken,
  };
}
