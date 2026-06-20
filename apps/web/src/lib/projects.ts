/* ──────────────────────────────────────────────────────────
   insPRO — Proje veri katmanı (geçici: localStorage)
   Supabase şeması hazır olduğunda bu modülün fonksiyonları
   API çağrılarıyla değiştirilecek; arayüz aynı kalacak.
   ────────────────────────────────────────────────────────── */

import { projeyiBulutaYaz, projeyiBuluttanSil } from "./projeSenkron";
import { islemKaydet } from "./islemLog";

export type ProjectType = "konut" | "villa" | "ticari";
export type PhaseStatus = "bekliyor" | "devam" | "tamam";

export interface ProjectPhase {
  name: string;
  status: PhaseStatus;
}

/* ── Bina / kat / daire modeli ── */

export type FloorUsage = "bodrum" | "zemin" | "normal" | "cati" | "otopark";
export type ApartmentType =
  | "1+1" | "2+1" | "3+1" | "4+1" | "5+1"
  | "dükkan" | "depo" | "ofis" | "sığınak" | "yönetim"
  | "elektrik" | "su" | "kapıcı" | "kazan" | "diğer";
export type RoofType = "ahsap" | "beton" | "celik";

/** Pencere: doğrama tipi + m². */
export interface Pencere {
  tip: string; // "pvc" | "aluminyum" | "ahsap"
  alan?: number;
}

export const FLOOR_USAGE_LABELS: Record<FloorUsage, string> = {
  bodrum: "Bodrum",
  zemin: "Zemin Kat",
  normal: "Normal Kat",
  cati: "Çatı Katı",
  otopark: "Otopark",
};

export const ROOF_LABELS: Record<RoofType, string> = {
  ahsap: "Ahşap",
  beton: "Betonarme",
  celik: "Çelik",
};

export const APT_TYPES: ApartmentType[] = [
  "1+1", "2+1", "3+1", "4+1", "5+1",
  "dükkan", "depo", "ofis", "sığınak", "yönetim",
  "elektrik", "su", "kapıcı", "kazan", "diğer",
];

export const APT_TYPE_LABELS: Record<ApartmentType, string> = {
  "1+1": "1+1 Daire", "2+1": "2+1 Daire", "3+1": "3+1 Daire",
  "4+1": "4+1 Daire", "5+1": "5+1 Daire",
  "dükkan": "Dükkan", "depo": "Depo", "ofis": "Ofis",
  "sığınak": "Sığınak", "yönetim": "Yönetim Odası",
  "elektrik": "Elektrik Odası", "su": "Su Odası",
  "kapıcı": "Kapıcı Dairesi", "kazan": "Kazan Dairesi", "diğer": "Diğer",
};

/** Bir daire/bağımsız bölümün iç detayı (PDF'ten okunan veya elle girilen). */
export interface RoomDetail {
  alan?: number;            // brüt m² (dükkan/depo için tek alan)
  salonAlanlar?: number[];  // her salonun m²'si
  odaAlanlar?: number[];    // her odanın m²'si
  mutfakVar?: boolean;
  mutfakAlan?: number;      // mutfak m²
  banyoVar?: boolean;
  banyoAlan?: number;       // banyo m²
  wcVar?: boolean;
  wcAlan?: number;          // wc m²
  // PDF'ten gelebilen ek metrajlar (opsiyonel)
  mutfakDolabiAlt?: number; // alt dolap, metretül
  mutfakDolabiUst?: number; // üst dolap, metretül
  kapi?: number;
  klozet?: number;
  musluk?: number;
  lavabo?: number;
  pencere?: number;
  // Detaylı metraj
  pencereler?: Pencere[];        // doğrama tipi + m²
  pozKalemler?: PozKalem[];      // pozdan seçilen daire metraj kalemleri (yeni)
  ekstra?: Record<string, number>; // (eski serbest alanlar — geriye dönük)
}

/** "2+1" → { oda: 2, salon: 1 }. Daire değilse {0,0}. */
export function tipOdaSalon(tip: ApartmentType): { oda: number; salon: number } {
  const m = /^(\d+)\+(\d+)$/.exec(tip);
  return m ? { oda: parseInt(m[1]), salon: parseInt(m[2]) } : { oda: 0, salon: 0 };
}

/** Daire tipi mi (X+Y) yoksa dükkan/depo/ofis mi? */
export function isDaireTipi(tip: ApartmentType): boolean {
  return /^\d+\+\d+$/.test(tip);
}

export interface Apartment {
  id: string;
  tip: ApartmentType;
  adet: number;             // bu tipten kaç adet
  detay: RoomDetail;
}

export interface FloorPlan {
  id: string;
  ad: string;               // "Zemin Kat", "Normal Kat" …
  kullanim: FloorUsage;
  benzerAdet?: number;      // bu kat şablonu kaç ÖZDEŞ katı temsil eder (varsayılan 1)
  pdfAdi?: string;          // yüklenen plan dosyası
  aiNot?: string;           // AI çıkarım notu
  daireler: Apartment[];
  // Bina ana kalem (kat bazlı)
  katAlani?: number;        // kat brüt m²
  perdeAlani?: number;      // perde m²
  holMalzeme?: string;      // hol kaplama cinsi
  holM2?: number;           // hol m²
}

export interface BuildingDetails {
  katYuksekligi?: number;   // m
  catiTipi?: RoofType;
  catiAlan?: number;        // m²
  toplamDaire?: number;
  asansorAdet?: number;
  asansorDurak?: number;
  asansorCins?: string;
  merdivenBasamak?: number;
  merdivenAlan?: number;    // m²
  binaHol?: number;         // m²
  yanginMerdiveni?: boolean;
  // Bina ana kalem bilgileri
  anaKalemPoz?: PozKalem[];  // pozdan seçilen ana kalemler + miktar (yeni)
  anaKalem?: Record<string, number>;     // (eski serbest alanlar — geriye dönük)
  anaKalemSecim?: Record<string, string>;
  iscilikler?: IscilikKaydi[]; // işçilik kalemleri + usta bilgisi
}

/** Pozdan seçilmiş bir bina ana kalemi + miktar. */
export interface PozKalem {
  id: string;
  pozKod: string;
  kalem: string;   // poz adı
  birim: string;
  miktar?: number;
}

/** Bir işçilik kalemi için usta/taşeron kaydı. */
export interface IscilikKaydi {
  id: string;
  kalem: string;     // poz adı (pozdan gelir) ör: "Saten alçı kaplaması…"
  pozKod?: string;   // bağlı ÇŞB poz kodu
  birim?: string;
  adSoyad?: string;
  telefon?: string;
  tutar?: number;    // ₺
}

export interface Project {
  id: string;
  name: string;
  city: string;
  type: ProjectType;
  area: number; // toplam inşaat alanı m²
  floors: number;
  budget: number | null; // tahmini bütçe ₺
  createdAt: string;
  phases: ProjectPhase[];
  katlar?: FloorPlan[];     // kat planları (PDF veya elle)
  bina?: BuildingDetails;   // bina geneli detaylar
  kendiFiyat?: Record<string, number>; // keşif kalemi → kendi (gerçekleşen) birim fiyat
  pozKutuphane?: string;    // bu projenin kullanacağı poz kütüphanesi (kut1 / kut2)
}

export const PHASE_NAMES = [
  "Zemin Etüdü & Ruhsat",
  "Şantiye Kurulumu",
  "Kazı & İksa",
  "Temel & Yalıtım",
  "Kaba Yapı",
  "Çatı",
  "Duvarlar & Şap",
  "Mekanik Tesisat",
  "Elektrik Tesisatı",
  "Alçı · Sıva · Boya",
  "Dış Cephe & İskele",
  "Çevre Düzenleme",
  "İskan & Teslim",
] as const;

export const TYPE_LABELS: Record<ProjectType, string> = {
  konut: "Konut / Apartman",
  villa: "Villa / Müstakil",
  ticari: "Ticari / İş Yeri",
};

const STORAGE_KEY = "inspro-projects";

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function getProject(id: string): Project | undefined {
  return loadProjects().find((p) => p.id === id);
}

export function createProject(
  data: Omit<Project, "id" | "createdAt" | "phases">,
): Project {
  const project: Project = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    phases: PHASE_NAMES.map((name) => ({ name, status: "bekliyor" })),
  };
  saveProjects([project, ...loadProjects()]);
  void projeyiBulutaYaz(project); // bulut senkronu (oturum varsa)
  islemKaydet("olustur", "proje", project.name, { id: project.id, sehir: project.city });
  return project;
}

export function updateProject(updated: Project) {
  saveProjects(loadProjects().map((p) => (p.id === updated.id ? updated : p)));
  void projeyiBulutaYaz(updated);
}

export function deleteProject(id: string) {
  const ad = loadProjects().find((p) => p.id === id)?.name;
  saveProjects(loadProjects().filter((p) => p.id !== id));
  void projeyiBuluttanSil(id);
  islemKaydet("sil", "proje", ad ?? id);
}

/** Bir keşif kalemi için kendi (gerçekleşen) birim fiyatını kaydeder. */
export function setKendiFiyat(projectId: string, kalemKey: string, birimFiyat: number | undefined) {
  let degisen: Project | undefined;
  saveProjects(
    loadProjects().map((p) => {
      if (p.id !== projectId) return p;
      const kendiFiyat = { ...(p.kendiFiyat ?? {}) };
      if (birimFiyat === undefined || birimFiyat <= 0) delete kendiFiyat[kalemKey];
      else kendiFiyat[kalemKey] = birimFiyat;
      degisen = { ...p, kendiFiyat };
      return degisen;
    }),
  );
  if (degisen) void projeyiBulutaYaz(degisen);
}

/** Tamamlanan aşama oranı (0-100). Devam eden aşama yarım sayılır. */
export function projectProgress(p: Project): number {
  const score = p.phases.reduce(
    (sum, ph) => sum + (ph.status === "tamam" ? 1 : ph.status === "devam" ? 0.5 : 0),
    0,
  );
  return Math.round((score / p.phases.length) * 100);
}

export function formatTL(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}
