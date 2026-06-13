/* ──────────────────────────────────────────────────────────
   insPRO — Poz CSV/Excel içe aktarma ayrıştırıcısı
   Resmî ÇŞB birim fiyat dosyaları çoğunlukla şu sütunları
   içerir: Poz No · Tanım/Açıklama · Birim · Birim Fiyat.
   Ayraç (; veya ,) ve sütun adları esnek eşleştirilir.
   ────────────────────────────────────────────────────────── */

import type { Poz, PozKaynak } from "@/lib/pozlar";

export interface ImportSonuc {
  pozlar: Poz[];
  hatalar: string[];
  okunan: number;
}

const KOD_BASLIK = ["poz", "poz no", "poz no.", "kod", "pozno", "poz numarası"];
const AD_BASLIK = ["tanım", "tanim", "açıklama", "aciklama", "ad", "iş kalemi", "imalat"];
const BIRIM_BASLIK = ["birim", "ölçü", "olcu"];
const FIYAT_BASLIK = ["birim fiyat", "fiyat", "tutar", "2026", "2025"];

function baslikBul(headers: string[], adaylar: string[]): number {
  return headers.findIndex((h) =>
    adaylar.some((a) => h.includes(a)),
  );
}

function sayiCevir(raw: string): number {
  // "1.234,56" (TR) veya "1234.56" → number
  const temiz = raw.trim().replace(/\s/g, "");
  if (/,\d{1,2}$/.test(temiz)) {
    return parseFloat(temiz.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(temiz.replace(/,/g, ""));
}

function satirBol(line: string, ayrac: string): string[] {
  // Basit CSV: tırnak içi ayraçları korur
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ayrac && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim().replace(/^"|"$/g, ""));
}

export function parsePozCsv(text: string, kaynak: PozKaynak, yil: number): ImportSonuc {
  const temizMetin = text.replace(/^﻿/, ""); // BOM at
  const lines = temizMetin.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { pozlar: [], hatalar: ["Dosya boş veya yalnızca başlık içeriyor."], okunan: 0 };
  const ayrac = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = lines.map((l) => satirBol(l, ayrac));
  return parsePozRows(rows, kaynak, yil);
}

/** Satır dizilerinden (Excel veya CSV) poz ayrıştırır. İlk satır başlık. */
export function parsePozRows(rows: string[][], kaynak: PozKaynak, yil: number): ImportSonuc {
  const hatalar: string[] = [];
  if (rows.length < 2) return { pozlar: [], hatalar: ["Dosya boş veya yalnızca başlık içeriyor."], okunan: 0 };

  const headers = rows[0].map((h) => String(h).trim().toLowerCase());
  const iKod = baslikBul(headers, KOD_BASLIK);
  const iAd = baslikBul(headers, AD_BASLIK);
  const iBirim = baslikBul(headers, BIRIM_BASLIK);
  const iFiyat = baslikBul(headers, FIYAT_BASLIK);

  if (iKod < 0 || iAd < 0 || iFiyat < 0) {
    return {
      pozlar: [],
      hatalar: [`Gerekli sütunlar bulunamadı. Beklenen başlıklar: Poz No, Tanım, Birim, Birim Fiyat. Bulunan: ${headers.join(", ")}`],
      okunan: 0,
    };
  }

  const ts = new Date().toISOString();
  const pozlar: Poz[] = [];
  let okunan = 0;

  for (let i = 1; i < rows.length; i++) {
    const c = rows[i].map((x) => String(x ?? "").trim());
    okunan++;
    const kod = c[iKod];
    const ad = c[iAd];
    if (!kod || !ad) continue;
    const fiyat = sayiCevir(c[iFiyat] ?? "");
    if (!Number.isFinite(fiyat) || fiyat <= 0) {
      hatalar.push(`Satır ${i + 1} (${kod}): geçersiz fiyat "${c[iFiyat]}"`);
      continue;
    }
    pozlar.push({
      kod, ad,
      birim: (iBirim >= 0 ? c[iBirim] : "") || "ad",
      kategori: kod.split(/[.\-/]/)[0] || "Genel",
      kaynak, yil, resmiFiyat: fiyat, sonGuncelleme: ts,
      guncellemeNotu: `${kaynak} ${yil} içe aktarma`,
    });
  }
  return { pozlar, hatalar, okunan };
}
