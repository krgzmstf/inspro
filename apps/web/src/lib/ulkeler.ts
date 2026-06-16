/* insPRO — Ülke telefon kodları (uluslararası telefon girişi) */

export interface Ulke { ad: string; kod: string; bayrak: string }

export const ULKELER: Ulke[] = [
  { ad: "Türkiye", kod: "+90", bayrak: "🇹🇷" },
  { ad: "Almanya", kod: "+49", bayrak: "🇩🇪" },
  { ad: "Avusturya", kod: "+43", bayrak: "🇦🇹" },
  { ad: "Hollanda", kod: "+31", bayrak: "🇳🇱" },
  { ad: "Belçika", kod: "+32", bayrak: "🇧🇪" },
  { ad: "Fransa", kod: "+33", bayrak: "🇫🇷" },
  { ad: "İngiltere", kod: "+44", bayrak: "🇬🇧" },
  { ad: "İsviçre", kod: "+41", bayrak: "🇨🇭" },
  { ad: "İtalya", kod: "+39", bayrak: "🇮🇹" },
  { ad: "İspanya", kod: "+34", bayrak: "🇪🇸" },
  { ad: "ABD/Kanada", kod: "+1", bayrak: "🇺🇸" },
  { ad: "Rusya", kod: "+7", bayrak: "🇷🇺" },
  { ad: "Azerbaycan", kod: "+994", bayrak: "🇦🇿" },
  { ad: "KKTC", kod: "+90", bayrak: "🇨🇾" },
  { ad: "Katar", kod: "+974", bayrak: "🇶🇦" },
  { ad: "BAE", kod: "+971", bayrak: "🇦🇪" },
  { ad: "Suudi Arabistan", kod: "+966", bayrak: "🇸🇦" },
  { ad: "Irak", kod: "+964", bayrak: "🇮🇶" },
  { ad: "İran", kod: "+98", bayrak: "🇮🇷" },
];
