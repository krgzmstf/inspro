import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ThemeVars from "@/components/ThemeVars";
import MkAiWidget from "./MkAiWidget";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "insPRO — İnşaatın Tüm Süreçleri Tek Platformda",
  description:
    "Proje dosyanı yükle; keşif-metraj, maliyet hesabı, yapay zeka risk analizi, 3D konsept görseller, kazıdan teslime yol haritası ve muhasebe — web ve mobilde.",
  keywords: [
    "inşaat yönetimi",
    "metraj hesaplama",
    "inşaat maliyet hesaplama",
    "keşif metraj",
    "şantiye takip",
    "hakediş",
    "inşaat muhasebesi",
    "yapay zeka inşaat",
  ],
  openGraph: {
    title: "insPRO — İnşaatın Tüm Süreçleri Tek Platformda",
    description:
      "PDF/DXF proje analizi, otomatik keşif-metraj, güncel fiyatlarla maliyet, AI risk danışmanı ve tam muhasebe.",
    locale: "tr_TR",
    type: "website",
    siteName: "insPRO",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-slate-800">
        <ThemeVars />
        {children}
        {/* Tüm sayfalarda sağ altta yüzen mk_ai asistanı */}
        <MkAiWidget />
      </body>
    </html>
  );
}
