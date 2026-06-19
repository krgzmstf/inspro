/* ──────────────────────────────────────────────────────────
   insPRO — Capacitor (native) statik build script'i

   Next.js App Router'da `output: "export"` ile sunucu API route'ları
   (app/api/*) bir arada derlenemez. Bu script:
     1) app/api klasörünü geçici olarak kenara taşır
     2) CAP_EXPORT=1 ile statik export alır (out/)  → native paket
     3) api klasörünü her durumda geri koyar
     4) `npx cap sync` ile out/ içeriğini Android/iOS'a kopyalar

   Native uygulama VERİ için canlı Supabase'e, ONLINE API'ler için
   canlı web backend'ine bağlanır (aşağıdaki NEXT_PUBLIC_* değerleri).
   Offline iken her şey localStorage + yerel mk_ai ile çalışır.
   ────────────────────────────────────────────────────────── */

import { execSync } from "node:child_process";
import { existsSync, renameSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const kok = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(kok, "src", "app", "api");
const stashDir = join(kok, ".cap-stash", "api");

function calistir(komut, env = {}) {
  execSync(komut, { cwd: kok, stdio: "inherit", env: { ...process.env, ...env } });
}

// 1) api'yi kenara taşı
if (existsSync(apiDir)) {
  mkdirSync(join(kok, ".cap-stash"), { recursive: true });
  if (existsSync(stashDir)) {
    console.error("HATA: .cap-stash/api zaten var — önceki build yarıda kalmış olabilir. Elle geri taşıyın.");
    process.exit(1);
  }
  renameSync(apiDir, stashDir);
  console.log("• app/api geçici olarak kenara alındı");
}

let hata = null;
try {
  // Bayat tip/cache temizliği (dev modundan kalan validator api'leri arayabilir)
  for (const d of [".next", "out"]) {
    const yol = join(kok, d);
    if (existsSync(yol)) { rmSync(yol, { recursive: true, force: true }); }
  }
  console.log("• .next ve out temizlendi");

  // 2) statik export (native, canlı backend'e bağlı)
  calistir("npx next build", {
    CAP_EXPORT: "1",
    NEXT_PUBLIC_SUPABASE_URL: "https://api-inspro.yazeproje.com",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxNzIzMTYzLCJleHAiOjE5Mzk0MDMxNjN9.2PQm7klk3t-_s_yUWufITguCn0x1s_COLs3LgB9NRdM",
    NEXT_PUBLIC_REMOTE_BASE: "https://inspro.yazeproje.com",
  });
} catch (e) {
  hata = e;
} finally {
  // 3) api'yi her durumda geri koy
  if (existsSync(stashDir)) {
    renameSync(stashDir, apiDir);
    console.log("• app/api geri yerine kondu");
  }
}

if (hata) {
  console.error("Statik export başarısız:", hata.message);
  process.exit(1);
}

// 4) native platformlara senkronla
calistir("npx cap sync");
console.log("\n✓ Capacitor senkron tamam. Android Studio: npm run cap:android");
