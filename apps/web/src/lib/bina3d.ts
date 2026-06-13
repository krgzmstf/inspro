/* ──────────────────────────────────────────────────────────
   insPRO — 3B bina kütlesi yardımcıları

   Projenin kat verisinden (katlar, katAlani, benzerAdet, kullanim)
   istiflenebilir kat dilimleri üretir. Bodrumlar yer altına,
   üst katlar yukarı doğru dizilir. Ayak izi kat alanından türetilir.
   ────────────────────────────────────────────────────────── */

import type { Project, FloorUsage } from "./projects";

export interface Kat3D {
  id: string;
  ad: string;
  kullanim: FloorUsage;
  alan: number;        // m²
  daireSayisi: number;
  w: number;           // genişlik (m, sahne ölçeği)
  d: number;           // derinlik (m)
  y: number;           // taban yüksekliği (m, 0 = zemin tabanı)
  h: number;           // kat yüksekliği (m)
  bodrum: boolean;
}

export const KULLANIM_RENK: Record<FloorUsage, string> = {
  bodrum: "#475569",   // slate
  otopark: "#64748b",  // gri
  zemin: "#f5b80b",    // brand sarı
  normal: "#2a9fbf",   // turkuaz
  cati: "#b45309",     // kiremit
};

/** Kat alanından dikdörtgen ayak izi (≈1.3:1 en-boy). */
function ayakIzi(alan: number): { w: number; d: number } {
  const a = Math.max(alan, 1);
  return { w: Math.sqrt(a * 1.3), d: Math.sqrt(a / 1.3) };
}

/** Projeyi istiflenmiş 3B kat dilimlerine çevirir (alttan üste). */
export function binaKatlari(project: Project): Kat3D[] {
  const katYuk = project.bina?.katYuksekligi && project.bina.katYuksekligi > 0 ? project.bina.katYuksekligi : 3;
  const katlar = project.katlar ?? [];

  // benzerAdet'e göre düzleştir
  type Flat = { id: string; ad: string; kullanim: FloorUsage; alan: number; daire: number };
  const flat: Flat[] = [];
  const toplamKat = katlar.reduce((s, k) => s + (k.benzerAdet && k.benzerAdet > 0 ? k.benzerAdet : 1), 0) || project.floors || 1;
  const varsayilanAlan = project.area > 0 && toplamKat > 0 ? project.area / toplamKat : 100;

  for (const k of katlar) {
    const n = k.benzerAdet && k.benzerAdet > 0 ? k.benzerAdet : 1;
    const alan = k.katAlani && k.katAlani > 0 ? k.katAlani : varsayilanAlan;
    const daire = (k.daireler ?? []).reduce((s, a) => s + (a.adet || 0), 0);
    for (let i = 0; i < n; i++) {
      flat.push({ id: `${k.id}-${i}`, ad: n > 1 ? `${k.ad} ${i + 1}` : k.ad, kullanim: k.kullanim, alan, daire });
    }
  }

  // kat yoksa: brüt alandan tek blok kütle üret
  if (flat.length === 0) {
    const n = Math.max(1, project.floors || 1);
    const alan = project.area > 0 ? project.area / n : 100;
    for (let i = 0; i < n; i++) {
      flat.push({ id: `oto-${i}`, ad: `${i + 1}. Kat`, kullanim: i === 0 ? "zemin" : "normal", alan, daire: 0 });
    }
  }

  const bodrumlar = flat.filter((f) => f.kullanim === "bodrum");
  const ustler = flat.filter((f) => f.kullanim !== "bodrum");

  const sonuc: Kat3D[] = [];
  // üst katlar: y=0'dan yukarı
  let y = 0;
  for (const f of ustler) {
    const { w, d } = ayakIzi(f.alan);
    sonuc.push({ id: f.id, ad: f.ad, kullanim: f.kullanim, alan: f.alan, daireSayisi: f.daire, w, d, y, h: katYuk, bodrum: false });
    y += katYuk;
  }
  // bodrumlar: y=0'dan aşağı (listedeki ilk bodrum en üstteki -1. kat)
  let yb = 0;
  for (const f of bodrumlar) {
    const { w, d } = ayakIzi(f.alan);
    yb -= katYuk;
    sonuc.push({ id: f.id, ad: f.ad, kullanim: f.kullanim, alan: f.alan, daireSayisi: f.daire, w, d, y: yb, h: katYuk, bodrum: true });
  }
  return sonuc;
}
