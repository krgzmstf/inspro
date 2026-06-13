"use client";

import { useEffect } from "react";

export const THEME_STORAGE_KEY = "inspro-theme";

export type ThemeOverrides = Record<string, string>;

export function applyThemeVars(vars: ThemeOverrides) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

/** Tarayıcıda kayıtlı tema renklerini tüm sitede uygular (/tema ekranından ayarlanır). */
export default function ThemeVars() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) applyThemeVars(JSON.parse(saved));
    } catch {
      // bozuk kayıt — yoksay
    }
  }, []);

  return null;
}
