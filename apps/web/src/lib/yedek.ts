/* ──────────────────────────────────────────────────────────
   insPRO — Tam proje yedekleme / geri yükleme

   Tüm veri localStorage'da "inspro-" önekiyle tutulur (projeler,
   metraj, muhasebe, hakediş, teklif, saha, personel, pozlar…).
   Bu modül o anahtarların TAMAMINI tek bir JSON dosyasına alır
   (yedek indir) ve geri yükler. Önek tabanlı tarama yapar → yeni
   bir modül anahtarı eklense bile otomatik kapsanır.

   Supabase'e geçilene kadar veri yalnız tarayıcıda; bu yedek
   cihaz değişimi / tarayıcı temizliği karşısında tek güvencedir.
   ────────────────────────────────────────────────────────── */

const PREFIX = "inspro-";

export interface YedekDosya {
  uygulama: "insPRO";
  surum: number;
  tarih: string; // ISO
  veriler: Record<string, string>; // anahtar → ham (stringify edilmiş) değer
}

/** localStorage'daki tüm inspro-* anahtarlarını ham haliyle toplar. */
export function yedekTopla(): YedekDosya {
  const veriler: Record<string, string> = {};
  if (typeof window !== "undefined") {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) veriler[k] = localStorage.getItem(k) ?? "";
    }
  }
  return { uygulama: "insPRO", surum: 1, tarih: new Date().toISOString(), veriler };
}

/** Yedeği JSON dosyası olarak indirir. */
export function yedekIndir(): void {
  const y = yedekTopla();
  const blob = new Blob([JSON.stringify(y, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inspro-yedek-${y.tarih.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Bir nesnenin geçerli insPRO yedeği olup olmadığını kontrol eder. */
export function yedekDogrula(obj: unknown): obj is YedekDosya {
  if (!obj || typeof obj !== "object") return false;
  const y = obj as Partial<YedekDosya>;
  return y.uygulama === "insPRO" && !!y.veriler && typeof y.veriler === "object";
}

/**
 * Yedeği geri yükler.
 * @param mod "degistir" → mevcut inspro-* verisini silip yedekle değiştirir;
 *            "birlestir" → mevcut verinin üzerine yazar (eksikleri tamamlar).
 * @returns yazılan anahtar sayısı
 */
export function yedekGeriYukle(y: YedekDosya, mod: "degistir" | "birlestir" = "degistir"): number {
  if (typeof window === "undefined") return 0;
  if (mod === "degistir") {
    const sil: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) sil.push(k);
    }
    sil.forEach((k) => localStorage.removeItem(k));
  }
  let n = 0;
  for (const [k, v] of Object.entries(y.veriler)) {
    if (k.startsWith(PREFIX)) {
      localStorage.setItem(k, v);
      n++;
    }
  }
  return n;
}

/** Yedek içeriğinin kısa özeti (önizleme için). */
export function yedekOzeti(y: YedekDosya): { anahtar: number; projeler: number; tarih: string } {
  const say = (k: string): number => {
    try {
      const a = JSON.parse(y.veriler[k] ?? "[]");
      return Array.isArray(a) ? a.length : a ? 1 : 0;
    } catch {
      return 0;
    }
  };
  return { anahtar: Object.keys(y.veriler).length, projeler: say("inspro-projects"), tarih: y.tarih };
}
