/* ──────────────────────────────────────────────────────────
   mk_ai — Ücretsiz görsel üretimi (Pollinations)

   Pollinations.ai anahtarsız ve ücretsiz bir text-to-image
   servisidir (Flux/SD tabanlı). Görsel doğrudan URL'den yüklenir;
   sunucuda işlem/RAM gerektirmez. mk_ai, proje verisinden zengin
   bir İngilizce prompt üretir; görsel bu prompt'tan oluşur.
   ────────────────────────────────────────────────────────── */

export interface GorselOpts {
  width?: number;
  height?: number;
  model?: string; // flux (varsayılan), turbo, vb.
  seed?: number;
}

/** Bir prompt'tan ücretsiz Pollinations görsel URL'si üretir. */
export function pollinationsUrl(prompt: string, o: GorselOpts = {}): string {
  const { width = 1024, height = 576, model = "flux", seed } = o;
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model,
    nologo: "true",
    enhance: "true",
  });
  if (seed != null) params.set("seed", String(seed));
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}
