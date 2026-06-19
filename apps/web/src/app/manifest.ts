import type { MetadataRoute } from "next";

// Statik export (Capacitor) için manifest'i derleme anında üret.
export const dynamic = "force-static";

/** PWA manifesti — telefona "uygulama gibi" kurulabilmesi için kimlik kartı. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "insPRO — İnşaat Yönetim Platformu",
    short_name: "insPRO",
    description: "İnşaatın tüm süreçleri tek platformda: keşif-metraj, maliyet, muhasebe ve yapay zeka.",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#15315c",
    theme_color: "#15315c",
    lang: "tr",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
