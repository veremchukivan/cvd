import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppCopy, appCopy, resolveUiLocale, LocaleCode, ThemeMode } from '../lib/i18n';

export const THEME_STORAGE_KEY = 'cvd-theme-mode';
export const LOCALE_STORAGE_KEY = 'cvd-locale';

type PreferencesContextValue = {
  theme: ThemeMode;
  setTheme: React.Dispatch<React.SetStateAction<ThemeMode>>;
  locale: LocaleCode;
  setLocale: React.Dispatch<React.SetStateAction<LocaleCode>>;
  copy: AppCopy;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function resolveInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'obsidian';
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'obsidian' || storedTheme === 'ivory') {
    return storedTheme;
  }

  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'ivory' : 'obsidian';
  }

  return 'obsidian';
}

function resolveInitialLocale(): LocaleCode {
  return resolveUiLocale();
}

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(resolveInitialTheme);
  const [locale, setLocale] = useState<LocaleCode>(resolveInitialLocale);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      theme,
      setTheme,
      locale,
      setLocale,
      copy: appCopy[locale],
    }),
    [locale, theme]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
}
