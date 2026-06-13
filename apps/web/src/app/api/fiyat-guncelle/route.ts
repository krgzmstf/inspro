import Anthropic from "@anthropic-ai/sdk";

/* ──────────────────────────────────────────────────────────
   insPRO — AI Piyasa Fiyatı Asistanı (sunucu tarafı)

   POST /api/fiyat-guncelle
   Body: { pozlar: [{kod, ad, birim, resmiFiyat, yil}], il?: string }

   Her poz için PİYASADAN en düşük ve en yüksek güncel fiyatı
   araştırır. ANTHROPIC_API_KEY varsa Claude (claude-opus-4-8)
   web aramasıyla; yoksa "demo modu" resmî fiyat etrafında
   tahmini bir aralık üretir (UI denenebilsin).

   Maliyet hesabı insPRO'da EN DÜŞÜK fiyatla yapılır; bu yüzden
   piyasa alt sınırı (min) kritik kalemdir.

   GÜVENLİK: API anahtarı yalnızca sunucuda (env) tutulur.
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

interface PiyasaSonuc {
  kod: string;
  min: number;
  max: number;
  not: string;
}

const MODEL = "claude-opus-4-8";

export async function POST(req: Request) {
  let body: { pozlar?: PozGirdi[]; il?: string };
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
    return Response.json(
      { error: "Tek seferde en fazla 40 poz araştırılabilir." },
      { status: 400 },
    );
  }

  // ── Demo modu: anahtar yoksa resmî fiyat etrafında aralık ──
  if (!process.env.ANTHROPIC_API_KEY) {
    const guncellemeler: PiyasaSonuc[] = pozlar.map((p) => ({
      kod: p.kod,
      min: Math.round(p.resmiFiyat * 0.88),
      max: Math.round(p.resmiFiyat * 1.18),
      not: "Demo aralık (±%12-18) — gerçek araştırma için ANTHROPIC_API_KEY tanımlayın",
    }));
    return Response.json({ demoMode: true, il, guncellemeler });
  }

  // ── Gerçek mod: Claude + web araması ──
  const client = new Anthropic();

  const liste = pozlar
    .map((p) => `- ${p.kod} | ${p.ad} | birim: ${p.birim} | resmî: ${p.resmiFiyat} ₺`)
    .join("\n");

  const sistem = `Sen bir inşaat satın alma uzmanısın. Türkiye'deki güncel piyasa malzeme + işçilik fiyatlarını araştırıyorsun. ${il} için her iş kalemi/malzemenin bugünkü PİYASA fiyat aralığını (en düşük ve en yüksek) Türk Lirası cinsinden belirle. Tedarikçi ilanları, hırdavat/yapı market fiyatları ve güncel piyasa kaynaklarını tercih et. Verilen resmî fiyat bir referanstır; piyasa genelde bunun biraz altında veya üstünde olabilir. Gerçekçi ve makul aralıklar ver.`;

  const gorev = `Aşağıdaki inşaat pozları için ${il} GÜNCEL PİYASA fiyat aralığını araştır (en düşük ve en yüksek ₺):

${liste}

Yanıtının SONUNDA, başka hiçbir metin olmadan, şu formatta bir JSON kod bloğu ver:
\`\`\`json
{"guncellemeler":[{"kod":"<poz kodu>","min":<en düşük ₺>,"max":<en yüksek ₺>,"not":"<kısa kaynak/gerekçe>"}]}
\`\`\``;

  try {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: gorev }];
    const tools: Anthropic.Messages.ToolUnion[] = [
      { type: "web_search_20260209", name: "web_search" },
    ];
    const cagir = () =>
      client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: sistem,
        tools,
        messages,
      });

    let response = await cagir();
    let guard = 0;
    while (response.stop_reason === "pause_turn" && guard < 4) {
      guard++;
      messages.push({ role: "assistant", content: response.content });
      response = await cagir();
    }

    if (response.stop_reason === "refusal") {
      return Response.json(
        { error: "Model bu isteği güvenlik nedeniyle yanıtlamadı." },
        { status: 422 },
      );
    }

    const metin = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const guncellemeler = jsonCikar(metin);
    if (!guncellemeler) {
      return Response.json(
        { error: "Model yanıtından fiyatlar ayrıştırılamadı.", ham: metin.slice(0, 500) },
        { status: 502 },
      );
    }

    const istenenKodlar = new Set(pozlar.map((p) => p.kod));
    const temiz = guncellemeler.filter(
      (g) =>
        istenenKodlar.has(g.kod) &&
        Number.isFinite(g.min) && g.min > 0 &&
        Number.isFinite(g.max) && g.max >= g.min,
    );

    return Response.json({ demoMode: false, il, guncellemeler: temiz });
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : "Bilinmeyen hata";
    return Response.json({ error: `AI servisi hatası: ${mesaj}` }, { status: 500 });
  }
}

function jsonCikar(metin: string): PiyasaSonuc[] | null {
  const blok = metin.match(/```json\s*([\s\S]*?)```/);
  const aday = blok ? blok[1] : metin.slice(metin.indexOf("{"), metin.lastIndexOf("}") + 1);
  try {
    const parsed = JSON.parse(aday);
    const arr = parsed.guncellemeler ?? parsed;
    if (!Array.isArray(arr)) return null;
    return arr.map((g: { kod: unknown; min: unknown; max: unknown; not?: unknown }) => ({
      kod: String(g.kod),
      min: Number(g.min),
      max: Number(g.max),
      not: String(g.not ?? "AI piyasa araştırması"),
    }));
  } catch {
    return null;
  }
}
