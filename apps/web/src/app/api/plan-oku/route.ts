import Anthropic from "@anthropic-ai/sdk";

/* ──────────────────────────────────────────────────────────
   insPRO — Kat Planı / Mimari Proje PDF Okuma (sunucu tarafı)

   POST /api/plan-oku
   Body: { pdfBase64: string, dosyaAdi?: string, kapsam?: "kat"|"mimari" }

   ANTHROPIC_API_KEY varsa Claude (claude-opus-4-8) PDF'i okur ve
   her bağımsız bölüm için (daire/dükkan) m², oda sayısı, ıslak
   hacim, mutfak dolabı (alt/üst metretül), kapı/klozet/musluk/
   lavabo adedi gibi metrajları çıkarır. Yoksa demo iskeleti döner.

   GERÇEKÇİ NOT: PDF'ten %100 otomatik metraj garanti edilemez;
   AI taslak çıkarır, kullanıcı düzeltir/onaylar.
   ────────────────────────────────────────────────────────── */

export const runtime = "nodejs";
export const maxDuration = 180;

const MODEL = "claude-opus-4-8";

interface DaireCikarim {
  tip: string;
  adet: number;
  ozet?: { alan?: number; oda?: number; salon?: number; banyo?: number; wc?: number; mutfak?: number };
  metraj?: Record<string, number>;
  pencereler?: { tip: string; alan?: number }[];
}

export async function POST(req: Request) {
  let body: { pdfBase64?: string; dosyaAdi?: string; kapsam?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const pdfBase64 = body.pdfBase64;
  if (!pdfBase64) {
    return Response.json({ error: "PDF verisi eksik." }, { status: 400 });
  }
  // ~ Boyut sınırı (base64 ≈ 1.37× ham): 18 MB ham ≈ 25 MB base64
  if (pdfBase64.length > 25_000_000) {
    return Response.json(
      { error: "PDF çok büyük (maks ~18 MB). Sayfaları bölerek deneyin." },
      { status: 413 },
    );
  }

  // ── Demo modu ──
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({
      demoMode: true,
      daireler: [],
      not: "DEMO: ANTHROPIC_API_KEY tanımlı değil. Daire bilgilerini elle girin; gerçek otomatik okuma için sunucuya anahtar ekleyin.",
    });
  }

  const client = new Anthropic();
  const mimari = body.kapsam === "mimari";

  const talimat = `Bu bir Türk inşaat ${mimari ? "mimari projesi" : "kat planı"} PDF'idir. ${
    mimari ? "Projedeki TÜM bağımsız bölümleri (daireler, dükkanlar) incele." : "Bu kattaki bağımsız bölümleri incele."
  } Her daire/bağımsız bölüm için planda görünen ölçü, oda adı ve sembollerden hem ÖZET bilgileri hem de İMALAT METRAJLARINI çıkar.

ÖZET (ozet) alanları:
- alan: brüt m², oda: yatak odası sayısı, salon: salon sayısı, banyo, wc, mutfak: mutfak m²

İMALAT METRAJI (metraj) — keşif için, m² ve adet cinsinden tahmin et:
- parke: laminat parke yapılacak kuru hacim (oda+salon) zemini m²
- yerFayansi: yer seramiği (banyo+wc+mutfak+antre+balkon) zemini m²
- duvarFayansi: duvar seramiği (banyo/wc/mutfak ıslak duvarları) m²
- alci: saten alçı/boya yapılacak duvar + tavan toplam m² (kabaca zemin alanı × 3)
- duvar: iç bölme tuğla duvar m²
- isitmaAlan: şap yapılacak tüm zemin m² (≈ brüt alan)
- kapi: iç kapı adedi

PENCERELER (pencereler): plandaki her pencere için doğrama tipi ve m²:
- tip: "pvc" | "aluminyum" | "ahsap", alan: m²

Emin olamadığın değeri ver ama makul tahmin yap (plan ölçeğinden). Tamamen bilinmiyorsa o alanı atla.

Yanıtının SONUNDA yalnızca şu JSON'u ver:
\`\`\`json
{"daireler":[{"tip":"3+1","adet":4,"ozet":{"alan":135,"oda":3,"salon":1,"banyo":1,"wc":1,"mutfak":12},"metraj":{"parke":95,"yerFayansi":22,"duvarFayansi":40,"alci":430,"duvar":120,"isitmaAlan":135,"kapi":8},"pencereler":[{"tip":"pvc","alan":14}]}],"not":"<kısa özet/uyarı>"}
\`\`\``;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            },
            { type: "text", text: talimat },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "Model PDF'i yanıtlamadı." }, { status: 422 });
    }

    const metin = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const parsed = jsonCikar(metin);
    if (!parsed) {
      return Response.json(
        { error: "Plan verisi ayrıştırılamadı.", ham: metin.slice(0, 600) },
        { status: 502 },
      );
    }
    return Response.json({ demoMode: false, daireler: parsed.daireler, not: parsed.not });
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : "Bilinmeyen hata";
    return Response.json({ error: `PDF okuma hatası: ${mesaj}` }, { status: 500 });
  }
}

function jsonCikar(metin: string): { daireler: DaireCikarim[]; not: string } | null {
  const blok = metin.match(/```json\s*([\s\S]*?)```/);
  const aday = blok ? blok[1] : metin.slice(metin.indexOf("{"), metin.lastIndexOf("}") + 1);
  try {
    const p = JSON.parse(aday);
    if (!Array.isArray(p.daireler)) return null;
    return { daireler: p.daireler, not: String(p.not ?? "") };
  } catch {
    return null;
  }
}
