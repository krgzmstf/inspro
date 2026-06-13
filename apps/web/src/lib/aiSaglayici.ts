/* ──────────────────────────────────────────────────────────
   mk_ai — Çok-sağlayıcılı yapay zekâ katmanı ("kendi platformumuz")

   Tek bir paralı sağlayıcıya (Anthropic) bağlı kalmak yerine,
   ÜCRETSIZ sağlayıcıları tek arayüzde toplar ve aralarında
   otomatik seçim + fallback yapar. Altta Vercel AI SDK'nın ince
   HTTP istemcileri vardır (model ağırlığı indirilmez → az RAM).

   Desteklenen ücretsiz sağlayıcılar:
     • groq     — Groq (kart İSTEMEZ; cömert ücretsiz tier, OpenAI-uyumlu)
     • gemini   — Google Gemini (AI Studio ücretsiz tier)
     • deepseek — DeepSeek (ucuz/ücretsiz tier)
     • github   — GitHub Models (ücretsiz GPT, OpenAI-uyumlu uç)

   Hangi sağlayıcının kullanılacağı, .env.local'de hangi anahtarın
   tanımlı olduğuna göre OTOMATIK belirlenir. Hiçbiri yoksa null
   döner ve çağıran taraf demo moduna düşer.
   ────────────────────────────────────────────────────────── */

import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateObject, generateText, type LanguageModel } from "ai";
import type { ZodType } from "zod";

export type SaglayiciId = "groq" | "gemini" | "deepseek" | "github";

interface SaglayiciTanim {
  id: SaglayiciId;
  etiket: string;
  /** Bu sağlayıcıyı açan ortam değişkeni(leri). İlk dolu olan kullanılır. */
  envKeys: string[];
  /** Ücretsiz anahtarın nereden alınacağı (UI/yardım için). */
  ucretsizKaynak: string;
  /** Yapılandırılmış dil modelini üretir. Anahtarın var olduğu varsayılır. */
  model: () => LanguageModel;
}

function env(...adlar: string[]): string | undefined {
  for (const a of adlar) {
    const v = process.env[a];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

/* Sağlayıcı kayıt defteri. Sıra = fallback önceliği (ücretsiz tier
   cömertliği + kalite dengesine göre): Gemini → DeepSeek → GitHub. */
const TANIMLAR: SaglayiciTanim[] = [
  {
    id: "groq",
    etiket: "Groq",
    envKeys: ["GROQ_API_KEY"],
    ucretsizKaynak: "https://console.groq.com/keys",
    model: () =>
      createOpenAI({
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: env("GROQ_API_KEY"),
      }).chat(process.env.GROQ_MODEL || "openai/gpt-oss-120b"),
  },
  {
    id: "gemini",
    etiket: "Google Gemini",
    envKeys: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"],
    ucretsizKaynak: "https://aistudio.google.com/apikey",
    model: () =>
      createGoogleGenerativeAI({
        apiKey: env("GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"),
      })(process.env.GEMINI_MODEL || "gemini-2.0-flash"),
  },
  {
    id: "deepseek",
    etiket: "DeepSeek",
    envKeys: ["DEEPSEEK_API_KEY"],
    ucretsizKaynak: "https://platform.deepseek.com/api_keys",
    model: () =>
      createDeepSeek({ apiKey: env("DEEPSEEK_API_KEY") })(
        process.env.DEEPSEEK_MODEL || "deepseek-chat",
      ),
  },
  {
    id: "github",
    etiket: "GitHub Models (GPT)",
    envKeys: ["GITHUB_MODELS_TOKEN", "GITHUB_TOKEN"],
    ucretsizKaynak: "https://github.com/marketplace/models",
    model: () =>
      createOpenAI({
        baseURL: "https://models.github.ai/inference",
        apiKey: env("GITHUB_MODELS_TOKEN", "GITHUB_TOKEN"),
      }).chat(process.env.GITHUB_MODEL || "openai/gpt-4o-mini"),
  },
];

/** Anahtarı tanımlı (kullanılabilir) sağlayıcılar, öncelik sırasıyla. */
export function aktifSaglayicilar(): SaglayiciId[] {
  return TANIMLAR.filter((t) => env(...t.envKeys)).map((t) => t.id);
}

/** UI/yardım için: tüm sağlayıcıların adı, durumu ve anahtar kaynağı. */
export function saglayiciDurumu() {
  return TANIMLAR.map((t) => ({
    id: t.id,
    etiket: t.etiket,
    aktif: Boolean(env(...t.envKeys)),
    ucretsizKaynak: t.ucretsizKaynak,
  }));
}

function siralaTanimlar(tercih?: SaglayiciId): SaglayiciTanim[] {
  const aktif = TANIMLAR.filter((t) => env(...t.envKeys));
  if (!tercih) return aktif;
  return [...aktif].sort((a, b) =>
    a.id === tercih ? -1 : b.id === tercih ? 1 : 0,
  );
}

export interface UretSonuc<T> {
  object: T;
  saglayici: SaglayiciId;
}

/**
 * Yapılandırılmış çıktı üretir; aktif sağlayıcıları sırayla dener,
 * biri patlarsa diğerine geçer (fallback).
 *
 * @returns Hiç sağlayıcı tanımlı değilse `null` (çağıran demo'ya düşsün).
 * @throws  Sağlayıcı(lar) var ama hepsi başarısız olursa son hatayı fırlatır.
 */
export async function mkAiUret<T>(opts: {
  schema: ZodType<T>;
  schemaName?: string;
  schemaDescription?: string;
  system: string;
  prompt: string;
  temperature?: number;
  tercih?: SaglayiciId;
}): Promise<UretSonuc<T> | null> {
  const sira = siralaTanimlar(opts.tercih);
  if (sira.length === 0) return null;

  let sonHata: unknown;
  for (const t of sira) {
    try {
      const { object } = await generateObject({
        model: t.model(),
        schema: opts.schema,
        schemaName: opts.schemaName,
        schemaDescription: opts.schemaDescription,
        system: opts.system,
        prompt: opts.prompt,
        temperature: opts.temperature ?? 0.3,
      });
      return { object: object as T, saglayici: t.id };
    } catch (e) {
      sonHata = e; // sıradaki sağlayıcıyı dene
    }
  }
  throw sonHata ?? new Error("Aktif sağlayıcı yok.");
}

export interface SohbetMesaj {
  role: "user" | "assistant";
  content: string;
}

/**
 * Serbest metin sohbet (mk_ai'ye soru sorma). Aktif sağlayıcıları
 * sırayla dener, biri patlarsa diğerine geçer (fallback).
 *
 * @returns Hiç sağlayıcı tanımlı değilse `null` (çağıran demo'ya düşsün).
 */
export async function mkAiSohbet(opts: {
  system: string;
  messages: SohbetMesaj[];
  temperature?: number;
  tercih?: SaglayiciId;
}): Promise<{ text: string; saglayici: SaglayiciId } | null> {
  const sira = siralaTanimlar(opts.tercih);
  if (sira.length === 0) return null;

  let sonHata: unknown;
  for (const t of sira) {
    try {
      const { text } = await generateText({
        model: t.model(),
        system: opts.system,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.4,
      });
      return { text, saglayici: t.id };
    } catch (e) {
      sonHata = e;
    }
  }
  throw sonHata ?? new Error("Aktif sağlayıcı yok.");
}
