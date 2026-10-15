"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dictionary, Locale, TranslationKey } from "@/lib/f1/i18n";

// ==========================================
// THEME CONTEXT
// ==========================================
type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

// ==========================================
// I18N CONTEXT
// ==========================================
interface I18nContextType {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "id",
  setLocale: () => {},
  t: (key) => dictionary.id[key] || key,
});

export const useI18n = () => useContext(I18nContext);

export function useUI() {
  const { theme, setTheme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  return { theme, setTheme, toggleTheme, locale, setLocale, t };
}

// ==========================================
// ROOT PROVIDERS
// ==========================================
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 5,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Theme state
  const [theme, setThemeState] = useState<Theme>("dark");
  const [locale, setLocaleState] = useState<Locale>("id");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("pitwall_theme") as Theme | null;
    if (savedTheme === "dark" || savedTheme === "light") {
      setThemeState(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      document.documentElement.classList.add("dark");
    }

    const savedLocale = localStorage.getItem("pitwall_locale") as Locale | null;
    if (savedLocale === "id" || savedLocale === "en") {
      setLocaleState(savedLocale);
    }
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("pitwall_theme", t);
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const setLocale = (loc: Locale) => {
    setLocaleState(loc);
    localStorage.setItem("pitwall_locale", loc);
  };

  const t = (key: TranslationKey): string => {
    const dict = dictionary[locale] || dictionary.id;
    return (dict as Record<string, string>)[key] || dictionary.en[key] || key;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
        <I18nContext.Provider value={{ locale, setLocale, t }}>
          <div className="min-h-screen bg-background text-text-primary transition-colors duration-200 flex flex-col font-sans">
            {children}
          </div>
        </I18nContext.Provider>
      </ThemeContext.Provider>
    </QueryClientProvider>
  );
}

export { Providers as AppProviders };
