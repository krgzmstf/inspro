/* ──────────────────────────────────────────────────────────
   insPRO — Excel / PDF içe & dışa aktarma yardımcıları

   • excelOku: .xlsx/.xls/.csv dosyasını satır dizilerine çevirir
   • excelYaz: başlık + satırlardan .xlsx indirir
   • pdfYazdir: tarayıcı yazdırma ile PDF (Türkçe kusursuz)
   ────────────────────────────────────────────────────────── */

import * as XLSX from "xlsx";

/** Dosyayı oku → ilk sayfanın satırları (string[][], ilk satır başlık). */
export async function excelOku(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" });
  return rows.map((r) => (r as unknown[]).map((c) => (c == null ? "" : String(c))));
}

/** Başlık + satırlardan .xlsx indir. */
export function excelYaz(dosyaAdi: string, sayfaAdi: string, basliklar: string[], satirlar: (string | number)[][]) {
  const aoa = [basliklar, ...satirlar];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // sütun genişliklerini içeriğe göre kabaca ayarla
  ws["!cols"] = basliklar.map((b, i) => {
    const maxLen = Math.max(b.length, ...satirlar.map((r) => String(r[i] ?? "").length));
    return { wch: Math.min(60, Math.max(8, maxLen + 2)) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sayfaAdi.slice(0, 31));
  XLSX.writeFile(wb, dosyaAdi.endsWith(".xlsx") ? dosyaAdi : `${dosyaAdi}.xlsx`);
}

/** Yazdırılabilir HTML açıp tarayıcı yazdırma penceresini tetikler (PDF olarak kaydet). */
export function pdfYazdir(
  baslik: string,
  basliklar: string[],
  satirlar: (string | number)[][],
  altNot?: string,
) {
  const esc = (s: unknown) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const thead = basliklar.map((b) => `<th>${esc(b)}</th>`).join("");
  const tbody = satirlar
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  const tarih = new Date().toLocaleString("tr-TR");
  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${esc(baslik)}</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{margin:24px;color:#1f2937}
    .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #126b85;padding-bottom:8px;margin-bottom:14px}
    .logo{font-size:20px;font-weight:800}.logo b{color:#f5b80b}
    h1{font-size:16px;margin:0}
    .meta{font-size:11px;color:#6b7280;text-align:right}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#f3f4f6;text-align:left;padding:6px 8px;border-bottom:2px solid #d1d5db;text-transform:uppercase;font-size:10px;color:#374151}
    td{padding:5px 8px;border-bottom:1px solid #eef0f3}
    tr:nth-child(even) td{background:#fafbfc}
    .alt{margin-top:12px;font-size:10px;color:#9ca3af}
    @media print{body{margin:10mm}}
  </style></head><body>
  <div class="head">
    <div><div class="logo">ins<b>PRO</b></div><h1>${esc(baslik)}</h1></div>
    <div class="meta">Tarih: ${tarih}<br>${satirlar.length} satır</div>
  </div>
  <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
  ${altNot ? `<div class="alt">${esc(altNot)}</div>` : ""}
  <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
  </body></html>`;
  yazdirHtml(html);
}

/** Özel gövde HTML'i ile yazdırılabilir belge açar (teklif vb.). */
export function pdfBelge(baslik: string, govdeHtml: string) {
  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${baslik}</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{margin:0;color:#1f2937}
    .sayfa{max-width:800px;margin:0 auto;padding:28px}
    .logo{font-size:24px;font-weight:800}.logo b{color:#f5b80b}
    table{width:100%;border-collapse:collapse}
    @media print{.sayfa{padding:12mm}}
  </style></head><body><div class="sayfa">${govdeHtml}</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
  </body></html>`;
  yazdirHtml(html);
}

function yazdirHtml(html: string) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Yazdırma penceresi açılamadı — açılır pencere izni verin.");
    return;
  }
  w.document.write(html);
  w.document.close();
}
