import { z } from "zod";
import { aktifSaglayicilar, mkAiUret, type SaglayiciId } from "@/lib/aiSaglayici";

/* ──────────────────────────────────────────────────────────
   insPRO — AI Piyasa Fiyatı Asistanı (sunucu tarafı)

   POST /api/fiyat-guncelle
   Body: { pozlar: [{kod, ad, birim, resmiFiyat, yil}], il?: string, tercih? }

   Her poz için piyasa fiyat aralığını (min/max ₺) verir.
   v2: Paralı Anthropic bırakıldı; mk_ai'nin çok-sağlayıcılı ücretsiz
   platformu (lib/aiSaglayici.ts → generateObject + Zod) kullanılır.

   ⚠️ NOT: Ücretsiz sağlayıcılar (Groq/DeepSeek/GitHub) CANLI WEB
   ARAMASI yapamaz. Bu yüzden sonuçlar modelin bilgisine + resmî
   fiyata dayalı "AI TAHMİNİ aralık"tır; canlı tedarikçi fiyatı
   değildir. Kesin fiyat için tedarikçiden teyit alın.

   Maliyet hesabı insPRO'da EN DÜŞÜK fiyatla yapılır; piyasa alt
   sınırı (min) kritik kalemdir.

   Sağlayıcı yoksa demo aralık (resmî ±%12-18) döner.
   GÜVENLİK: API anahtarları yalnızca sunucuda (env) tutulur.
   ────────────────────────────────────────────────────────── */

export const runtime = "nodejs";
export const maxDuration = 120;

interface PozGirdi {
  kod: string;
  ad: string;
  birim: string;
  resmiFiyat: number;
  yil: number;
}

const Cikti = z.object({
  guncellemeler: z
    .array(
      z.object({
        kod: z.string().describe("Pozun kodu (girdideki ile birebir aynı)."),
        min: z.number().describe("Tahmini en düşük piyasa birim fiyatı (₺)."),
        max: z.number().describe("Tahmini en yüksek piyasa birim fiyatı (₺)."),
        not: z.string().describe("Kısa gerekçe (ör. 'malzeme ağırlıklı', 'işçilik zammı')."),
      }),
    )
    .describe("Her poz için bir satır; girdideki tüm pozları kapsa."),
});

export async function POST(req: Request) {
  let body: { pozlar?: PozGirdi[]; il?: string; tercih?: SaglayiciId };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const pozlar = body.pozlar ?? [];
  const il = body.il?.trim() || "Türkiye geneli";

  if (!Array.isArray(pozlar) || pozlar.length === 0) {
    return Response.json({ error: "Güncellenecek poz listesi boş." }, { status: 400 });
  }
  if (pozlar.length > 40) {
    return Response.json({ error: "Tek seferde en fazla 40 poz araştırılabilir." }, { status: 400 });
  }

  // ── Demo modu: hiç sağlayıcı yoksa resmî fiyat etrafında aralık ──
  if (aktifSaglayicilar().length === 0) {
    const guncellemeler = pozlar.map((p) => ({
      kod: p.kod,
      min: Math.round(p.resmiFiyat * 0.88),
      max: Math.round(p.resmiFiyat * 1.18),
      not: "Demo aralık (±%12-18) — gerçek tahmin için ücretsiz bir AI anahtarı tanımlayın",
    }));
    return Response.json({ demoMode: true, saglayici: null, il, guncellemeler });
  }

  const liste = pozlar
    .map((p) => `- ${p.kod} | ${p.ad} | birim: ${p.birim} | resmî(${p.yil}): ${p.resmiFiyat} ₺`)
    .join("\n");

  const sistem =
    "Sen bir inşaat satın alma / maliyet uzmanısın. Türkiye'deki güncel piyasa malzeme + işçilik " +
    "fiyatları hakkında bilgine dayanarak her iş kalemi için makul bir PİYASA fiyat aralığı (min/max ₺) " +
    "tahmin edersin. Verilen resmî fiyat bir referanstır; piyasa genelde bunun bir miktar altında/üstünde " +
    "olur. Kurallar: (1) Canlı web araman YOK; gerçekçi, abartısız tahmin yap. (2) min ≤ max ve ikisi de " +
    "pozitif olsun. (3) Girdideki TÜM pozları, kodlarını birebir koruyarak döndür. (4) Türkçe kısa gerekçe yaz.";

  const gorev =
    `Bölge: ${il}. Aşağıdaki inşaat pozları için tahmini güncel piyasa fiyat aralığını (min/max ₺) ver:\n\n${liste}`;

  try {
    const sonuc = await mkAiUret({
      schema: Cikti,
      schemaName: "piyasaFiyatlari",
      schemaDescription: "İnşaat pozları için tahmini piyasa fiyat aralıkları.",
      system: sistem,
      prompt: gorev,
      temperature: 0.3,
      tercih: body.tercih,
    });

    if (!sonuc) return Response.json({ error: "Aktif sağlayıcı bulunamadı." }, { status: 500 });

    const istenenKodlar = new Set(pozlar.map((p) => p.kod));
    const temiz = sonuc.object.guncellemeler.filter(
      (g) =>
        istenenKodlar.has(g.kod) &&
        Number.isFinite(g.min) && g.min > 0 &&
        Number.isFinite(g.max) && g.max >= g.min,
    );

    return Response.json({ demoMode: false, saglayici: sonuc.saglayici, il, tahmin: true, guncellemeler: temiz });
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : "Bilinmeyen hata";
    return Response.json({ error: `AI servisi hatası: ${mesaj}` }, { status: 500 });
  }
}
