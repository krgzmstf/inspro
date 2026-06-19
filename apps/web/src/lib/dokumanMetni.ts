/* ──────────────────────────────────────────────────────────
   insPRO — Doküman → metin çıkarımı (istemci tarafı)

   Kullanıcının yüklediği PDF / Word (.docx) / metin dosyalarından
   metni TARAYICIDA çıkarır (sunucuya dosya gitmez) ve bilgi tabanına
   eklenecek parçalara (chunk) böler. Böylece mk_ai çevrimdışı da bu
   dökümanlarda arayıp kaynak göstererek yanıt verebilir.
   ────────────────────────────────────────────────────────── */

import type { YonetmelikKayit } from "./yonetmelik";

/** PDF'ten tüm sayfaların metnini çıkarır (pdfjs, tarayıcı). */
async function pdfMetni(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Worker: CDN (plan3d ile aynı). İlk yüklemede internet gerekir.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const parcalar: string[] = [];
  for (let s = 1; s <= pdf.numPages; s++) {
    const sayfa = await pdf.getPage(s);
    const icerik = await sayfa.getTextContent();
    const satir = icerik.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    if (satir.trim()) parcalar.push(satir);
  }
  return parcalar.join("\n\n");
}

/** Word (.docx) metnini çıkarır (mammoth, tarayıcı). */
async function docxMetni(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const sonuc = await mammoth.extractRawText({ arrayBuffer: buf });
  return sonuc.value ?? "";
}

/** Dosya türüne göre metni çıkarır. */
export async function dosyadanMetin(file: File): Promise<string> {
  const ad = file.name.toLowerCase();
  if (ad.endsWith(".pdf") || file.type === "application/pdf") return pdfMetni(file);
  if (ad.endsWith(".docx")) return docxMetni(file);
  if (ad.endsWith(".txt") || ad.endsWith(".md") || file.type.startsWith("text/")) return file.text();
  if (ad.endsWith(".doc")) throw new Error("Eski .doc desteklenmiyor — lütfen .docx olarak kaydedip yükleyin.");
  throw new Error("Desteklenmeyen tür. PDF, DOCX, TXT veya MD yükleyin.");
}

/** Uzun metni anlamlı parçalara böler (paragraf sınırı, ~maks karakter). */
function parcala(metin: string, maks = 900): string[] {
  const temiz = metin.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  if (temiz.length <= maks) return temiz ? [temiz] : [];
  const paragraflar = temiz.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const parcalar: string[] = [];
  let tampon = "";
  for (const p of paragraflar) {
    if ((tampon + "\n\n" + p).length > maks && tampon) { parcalar.push(tampon); tampon = ""; }
    if (p.length > maks) {
      // Çok uzun paragrafı cümlelere böl
      const cumleler = p.split(/(?<=[.!?])\s+/);
      for (const c of cumleler) {
        if ((tampon + " " + c).length > maks && tampon) { parcalar.push(tampon); tampon = ""; }
        tampon = tampon ? tampon + " " + c : c;
      }
    } else {
      tampon = tampon ? tampon + "\n\n" + p : p;
    }
  }
  if (tampon) parcalar.push(tampon);
  return parcalar;
}

/** Dosyadan bilgi tabanı kayıtları üretir (çıkarım + parçalama). */
export async function dokumandanBilgiler(file: File): Promise<YonetmelikKayit[]> {
  const metin = await dosyadanMetin(file);
  const parcalar = parcala(metin);
  if (!parcalar.length) throw new Error("Dosyadan metin çıkarılamadı (taranmış/boş olabilir).");
  const ad = file.name.replace(/\.[^.]+$/, "");
  return parcalar.map((p, i) => ({
    id: crypto.randomUUID(),
    baslik: parcalar.length > 1 ? `${ad} (bölüm ${i + 1}/${parcalar.length})` : ad,
    kaynak: file.name,
    etiketler: [],
    metin: p,
  }));
}
