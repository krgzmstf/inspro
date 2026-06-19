import { aktifSaglayicilar, mkAiSohbet, type SaglayiciId } from "@/lib/aiSaglayici";
import { hizSiniri } from "@/lib/hizSiniri";

/* ──────────────────────────────────────────────────────────
   mk_ai — Görsel prompt üretimi

   POST /api/mk-ai/gorsel
   Body: { baglam?: string, istek?: string, tercih?: SaglayiciId }

   Proje verisinden, fotogerçekçi bir mimari render için zengin
   İngilizce bir text-to-image prompt üretir (görsel modelleri
   İngilizce prompt'la daha iyi çalışır). Görselin kendisi istemci
   tarafında ücretsiz Pollinations URL'sinden yüklenir.
   ────────────────────────────────────────────────────────── */

export const runtime = "nodejs";
export const maxDuration = 60;

interface Govde {
  baglam?: string;
  istek?: string;
  tercih?: SaglayiciId;
}

const SISTEM =
  "You are an expert architectural visualization prompt engineer. Given a Turkish construction project's " +
  "data, write ONE single vivid English text-to-image prompt for a PHOTOREALISTIC architectural exterior " +
  "render of the building. Reflect the project's type, floor count and scale. Include: professional " +
  "architectural photography, realistic materials (glass, concrete, stone), natural daylight / golden hour, " +
  "landscaping and context, high detail, 8k. Do NOT include any text, words, signage or watermark in the " +
  "image. Output ONLY the prompt itself (no explanation, no quotes), maximum 60 words.";

const VARSAYILAN_PROMPT =
  "photorealistic architectural exterior render of a modern multi-storey residential building, glass and " +
  "concrete facade, balconies, landscaped surroundings, golden hour natural light, professional " +
  "architectural photography, high detail, 8k, no text";

export async function POST(req: Request) {
  const rl = hizSiniri(req, 20); if (rl) return rl;
  let body: Govde;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  // Sağlayıcı yoksa: makul bir varsayılan prompt ver (görsel yine ücretsiz üretilir).
  if (aktifSaglayicilar().length === 0) {
    return Response.json({ demoMode: true, saglayici: null, prompt: VARSAYILAN_PROMPT });
  }

  const kullanici =
    (body.istek?.trim() ? `User's visual request: ${body.istek.trim()}\n\n` : "") +
    `Project data:\n${body.baglam?.trim() || "(no detailed data)"}`;

  try {
    const sonuc = await mkAiSohbet({
      system: SISTEM,
      messages: [{ role: "user", content: kullanici }],
      temperature: 0.7,
      tercih: body.tercih,
    });
    if (!sonuc) return Response.json({ demoMode: true, saglayici: null, prompt: VARSAYILAN_PROMPT });
    const prompt = sonuc.text.trim().replace(/^["'`]+|["'`]+$/g, "").slice(0, 600) || VARSAYILAN_PROMPT;
    return Response.json({ demoMode: false, saglayici: sonuc.saglayici, prompt });
  } catch {
    // LLM patlarsa bile görsel üretilebilsin diye varsayılana düş.
    return Response.json({ demoMode: false, saglayici: null, prompt: VARSAYILAN_PROMPT });
  }
}
