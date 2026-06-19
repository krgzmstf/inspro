import { InferenceClient } from "@huggingface/inference";
import { hizSiniri } from "@/lib/hizSiniri";

/* ──────────────────────────────────────────────────────────
   mk_ai — Görsel üretim / düzenleme (çok-sağlayıcılı)

   POST /api/mk-ai/gorsel-uret
   Body: {
     prompt: string,              // İngilizce text-to-image promptu
     gorselBase64?: string,       // (ops.) yüklenen referans görsel (data URL veya saf base64)
     mimeType?: string,           // yüklenen görselin tipi (vars. image/jpeg)
   }

   Öncelik sırası (env'de hangi anahtar varsa):
     1) Hugging Face — ücretsiz, bölge kısıtı yok.
        • yükleme YOKSA → FLUX.1-schnell ile metinden görsel
        • yükleme VARSA → instruct-pix2pix ile yüklenen görseli dönüştürür (img2img)
     2) Gemini (Nano Banana) — yalnız billing açıksa çalışır (ülkede free tier=0).
     3) Hiçbiri olmazsa { yapildi:false } → istemci Pollinations yedeğine düşer.

   GÜVENLİK: API anahtarları yalnızca sunucuda (env).
   HF token (ücretsiz, kart yok): https://huggingface.co/settings/tokens
   .env.local: HUGGINGFACE_API_KEY=hf_...
   ────────────────────────────────────────────────────────── */

export const runtime = "nodejs";
export const maxDuration = 60;

interface Govde {
  prompt?: string;
  gorselBase64?: string;
  mimeType?: string;
}

function env(...adlar: string[]): string | undefined {
  for (const a of adlar) {
    const v = process.env[a];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

/** "data:image/png;base64,XXXX" → "XXXX" (saf base64). */
function safBase64(s: string): string {
  const i = s.indexOf("base64,");
  return i >= 0 ? s.slice(i + 7) : s;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer());
  const mt = blob.type || "image/png";
  return `data:${mt};base64,${buf.toString("base64")}`;
}

/* ── Hugging Face (ücretsiz) ── */
async function hfUret(token: string, prompt: string, gorsel?: { b64: string; mime: string }) {
  const hf = new InferenceClient(token);

  if (gorsel) {
    // img2img — yüklenen görseli prompt'a göre dönüştür.
    // NOT: HF ücretsiz tier'da editing modellerinin sağlayıcısı çoğu zaman
    // yok / paralı (fal-ai). Bu yüzden 40 sn'de yanıt gelmezse hata fırlat
    // → çağıran taraf metinden-üretime düşer (kullanıcı takılı kalmasın).
    const model = process.env.HF_IMG2IMG_MODEL || "black-forest-labs/FLUX.1-Kontext-dev";
    const bytes = Buffer.from(gorsel.b64, "base64");
    const inputBlob = new Blob([bytes], { type: gorsel.mime || "image/jpeg" });
    const zamanAsimi = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("img2img zaman aşımı (40 sn)")), 40_000),
    );
    const out = (await Promise.race([
      hf.imageToImage({ model, inputs: inputBlob, parameters: { prompt } }),
      zamanAsimi,
    ])) as Blob;
    return { dataUrl: await blobToDataUrl(out), model };
  }

  // text-to-image — FLUX.1-schnell.
  const model = process.env.HF_TEXT_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";
  const dataUrl = await hf.textToImage({ model, inputs: prompt }, { outputType: "dataUrl" });
  return { dataUrl, model };
}

/* ── Gemini (Nano Banana) — billing açıksa ── */
async function geminiUret(key: string, prompt: string, gorsel?: { b64: string; mime: string }) {
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (gorsel) parts.push({ inlineData: { mimeType: gorsel.mime || "image/jpeg", data: gorsel.b64 } });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const cikti = data?.candidates?.[0]?.content?.parts ?? [];
  for (const p of cikti) {
    const inline = p.inlineData ?? p.inline_data;
    if (inline?.data) {
      const mt = (inline.mimeType ?? inline.mime_type) || "image/png";
      return { dataUrl: `data:${mt};base64,${inline.data}`, model };
    }
  }
  throw new Error("Gemini görsel döndürmedi.");
}

export async function POST(req: Request) {
  const rl = hizSiniri(req, 10); if (rl) return rl;
  let body: Govde;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return Response.json({ error: "Prompt boş." }, { status: 400 });

  const gorsel = body.gorselBase64?.trim()
    ? { b64: safBase64(body.gorselBase64.trim()), mime: body.mimeType || "image/jpeg" }
    : undefined;

  const hfToken = env("HUGGINGFACE_API_KEY", "HF_TOKEN", "HF_API_KEY");
  const geminiKey = env("GEMINI_IMAGE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY");

  const hatalar: string[] = [];

  // 1) Hugging Face (ücretsiz)
  if (hfToken) {
    try {
      const r = await hfUret(hfToken, prompt, gorsel);
      return Response.json({ yapildi: true, saglayici: "huggingface", model: r.model, dataUrl: r.dataUrl });
    } catch (e) {
      hatalar.push(`HF: ${(e as Error).message}`);
      // img2img sağlayıcısı yoksa en azından metinden üret (kullanıcı boş kalmasın).
      if (gorsel) {
        try {
          const r2 = await hfUret(hfToken, prompt, undefined);
          return Response.json({
            yapildi: true,
            saglayici: "huggingface",
            model: r2.model,
            dataUrl: r2.dataUrl,
            not: "Yüklenen görsel ücretsiz tier'da dönüştürülemedi; metinden üretildi.",
          });
        } catch (e2) {
          hatalar.push(`HF-text2img: ${(e2 as Error).message}`);
        }
      }
    }
  }

  // 2) Gemini (billing açıksa)
  if (geminiKey) {
    try {
      const r = await geminiUret(geminiKey, prompt, gorsel);
      return Response.json({ yapildi: true, saglayici: "gemini", model: r.model, dataUrl: r.dataUrl });
    } catch (e) {
      hatalar.push(`Gemini: ${(e as Error).message}`);
    }
  }

  // 3) İstemci Pollinations yedeğine düşsün.
  return Response.json({
    yapildi: false,
    sebep: hfToken || geminiKey ? "saglayici-hata" : "anahtar-yok",
    detay: hatalar.join(" | ").slice(0, 400),
  });
}
