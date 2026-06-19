import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yazeproje.inspro",
  appName: "insPRO",
  // Next statik export çıktısı (cap-build script'i üretir)
  webDir: "out",
  android: {
    // Android WebView içinde https şeması (güvenli bağlam → service worker, kamera vb.)
    allowMixedContent: false,
  },
};

export default config;
