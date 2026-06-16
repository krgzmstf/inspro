/* ──────────────────────────────────────────────────────────
   insPRO — Kasa & Banka (finans hesapları) veri katmanı

   Firma genelinde (proje-üstü) kasa ve banka hesapları. Her
   muhasebe hareketi tahsil/ödendiğinde bir hesaba bağlanır;
   hesap bakiyesi = açılış + tahsilatlar − ödemeler.

   Geçici: localStorage. Supabase'e geçişte tek bu katman döner.
   ────────────────────────────────────────────────────────── */

import { loadAllMuhasebe } from "@/lib/muhasebe";

export type HesapTipi = "kasa" | "banka";

export interface FinansHesap {
  id: string;
  ad: string;            // "Merkez Kasa", "Ziraat TL"
  tip: HesapTipi;
  iban?: string;
  acilisBakiye: number;  // ₺
  createdAt: string;
}

const STORAGE_KEY = "inspro-finans-hesap";

export function loadHesaplar(): FinansHesap[] {
  if (typeof window === "undefined") return [];
  try {
    const ham: FinansHesap[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return ham.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  } catch {
    return [];
  }
}

function saveAll(hesaplar: FinansHesap[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hesaplar));
  void import("./genelSenkron").then((m) => m.modulYaz("finans-hesap"));
}

export function addHesap(data: Omit<FinansHesap, "id" | "createdAt">): FinansHesap {
  const hesap: FinansHesap = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  saveAll([...loadHesaplar(), hesap]);
  return hesap;
}

export function deleteHesap(id: string) {
  saveAll(loadHesaplar().filter((h) => h.id !== id));
}

export function getHesap(id: string): FinansHesap | undefined {
  return loadHesaplar().find((h) => h.id === id);
}

/** Bir hesabın güncel bakiyesi: açılış + tüm tahsilatlar − tüm ödemeler. */
export function hesapBakiyesi(hesapId: string, acilisBakiye: number): number {
  const tumKayitlar = loadAllMuhasebe().filter((k) => k.hesapId === hesapId);
  let bakiye = acilisBakiye;
  for (const k of tumKayitlar) {
    if (k.tip === "gelir") bakiye += k.odenenTutar;
    else bakiye -= k.odenenTutar;
  }
  return bakiye;
}
