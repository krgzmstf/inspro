/* ──────────────────────────────────────────────────────────
   insPRO — Senkron kuyruğu (offline-first)

   Tüm modüller önce localStorage'a yazılır; bu katman onları buluta
   (modul_veri JSONB blob) eşitler. Çevrimdışıyken yapılan değişiklikler
   "kirli" işaretlenir ve internet dönünce otomatik push edilir.

   Çakışma koruması: bir modül kirliyse (offline düzenlenmişse) açılış
   senkronunda bulut verisi YEREL'i EZMEZ — yerel buluta itilir.
   ────────────────────────────────────────────────────────── */

import { blobOku, blobYaz, aktifKullaniciId } from "./sb";

/** modul adı → localStorage anahtarı (tek-dizi tutan tüm modüller) */
export const MODUL_ANAHTAR: Record<string, string> = {
  projects: "inspro-projects",
  accounting: "inspro-muhasebe",
  metraj: "inspro-metraj",
  issurecleri: "inspro-issurecleri",
  saha: "inspro-saha",
  personel: "inspro-personel",
  puantaj: "inspro-puantaj",
  teklif: "inspro-teklif",
  hakedis: "inspro-hakedis",
  "asama-kalem": "inspro-asama-kalem",
  "finans-hesap": "inspro-finans-hesap",
  firma: "inspro-firma",
  "bilgi-tabani": "inspro-bilgi-tabani",
};

const KIRLI_KEY = "inspro-senkron-kirli";

function oku(key: string): unknown[] {
  if (typeof window === "undefined") return [];
  try { const v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// ── Kirli (bekleyen) modül kümesi ──
function kirliKume(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(KIRLI_KEY) || "[]")); }
  catch { return new Set(); }
}
function kirliKaydet(s: Set<string>) {
  try { localStorage.setItem(KIRLI_KEY, JSON.stringify([...s])); } catch { /* yok say */ }
  bildir();
}
function kirliEkle(modul: string) { const s = kirliKume(); s.add(modul); kirliKaydet(s); }
function kirliCikar(modul: string) { const s = kirliKume(); if (s.delete(modul)) kirliKaydet(s); }

export function bekleyenSayisi(): number { return kirliKume().size; }
export function kirliMi(modul: string): boolean { return kirliKume().has(modul); }
export function cevrimici(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

// ── Durum aboneliği (gösterge için) ──
export type SenkronDurum = { cevrimici: boolean; bekleyen: number; eslesiyor: boolean };
let eslesiyor = false;
const aboneler = new Set<(d: SenkronDurum) => void>();
function durum(): SenkronDurum { return { cevrimici: cevrimici(), bekleyen: bekleyenSayisi(), eslesiyor }; }
function bildir() { const d = durum(); aboneler.forEach((f) => f(d)); }
export function senkronAbone(f: (d: SenkronDurum) => void): () => void {
  aboneler.add(f); f(durum()); return () => aboneler.delete(f);
}

// ── Tek modülü buluta it ──
async function modulItele(modul: string): Promise<boolean> {
  const key = MODUL_ANAHTAR[modul];
  if (!key) return false;
  const ok = await blobYaz(modul, oku(key));
  if (ok) kirliCikar(modul); else kirliEkle(modul);
  return ok;
}

/** Bir modül yerelde değişti: kirli işaretle + (online ise) hemen itele. */
export function degisti(modul: string): void {
  kirliEkle(modul);
  if (cevrimici()) void modulItele(modul);
}

/** Kuyruğu boşalt: bekleyen tüm modülleri buluta it. (reconnect/açılış) */
export async function kuyruguBosalt(): Promise<void> {
  if (!cevrimici()) return;
  if ((await aktifKullaniciId()) === null) return;
  const bekleyen = [...kirliKume()];
  if (!bekleyen.length) return;
  eslesiyor = true; bildir();
  for (const modul of bekleyen) await modulItele(modul);
  eslesiyor = false; bildir();
}

/** Açılış senkronu: bulut otorite AMA kirli (offline düzenlenmiş) modüller
    yerelden buluta itilir (yerel kazanır → veri kaybı olmaz). */
export async function acilisSenkron(): Promise<void> {
  if ((await aktifKullaniciId()) === null) return;
  const kirli = kirliKume();
  for (const [modul, key] of Object.entries(MODUL_ANAHTAR)) {
    if (kirli.has(modul)) { if (cevrimici()) await modulItele(modul); continue; }
    const bulut = cevrimici() ? await blobOku(modul) : null;
    if (bulut === null) continue; // oturum yok / offline → yerel kalsın
    const yerel = oku(key);
    if (bulut.length === 0 && yerel.length > 0) { await modulItele(modul); }
    else { try { localStorage.setItem(key, JSON.stringify(bulut)); } catch { /* yok say */ } }
  }
  bildir();
}

// ── Ağ dinleyicileri ──
let baslatildi = false;
export function senkronBaslat(): () => void {
  if (typeof window === "undefined" || baslatildi) return () => {};
  baslatildi = true;
  const online = () => { bildir(); void kuyruguBosalt(); };
  const offline = () => bildir();
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  // Capacitor Network (native) — varsa
  void import("@capacitor/network").then(({ Network }) => {
    Network.addListener("networkStatusChange", (s) => { if (s.connected) online(); else offline(); });
  }).catch(() => {});
  // İlk açılışta kuyruğu dene
  void kuyruguBosalt();
  return () => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
    baslatildi = false;
  };
}
