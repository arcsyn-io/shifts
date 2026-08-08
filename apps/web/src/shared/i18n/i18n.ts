import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from '@/shared/i18n/resources/en';
import { ptBR } from '@/shared/i18n/resources/pt-BR';

export const supportedLocales = ['pt-BR', 'en'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = 'pt-BR';
export const fallbackLocale: SupportedLocale = 'en';
export const localeStorageKey = 'arcsyn-shift.locale';

interface LocaleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return supportedLocales.some((locale) => locale === value);
}

export function resolveLocale(value: string | null | undefined): SupportedLocale {
  return isSupportedLocale(value) ? value : defaultLocale;
}

export function readPersistedLocale(storage?: LocaleStorage): SupportedLocale {
  if (!storage) return defaultLocale;

  try {
    return resolveLocale(storage.getItem(localeStorageKey));
  } catch {
    return defaultLocale;
  }
}

export function persistLocale(storage: LocaleStorage | undefined, locale: SupportedLocale) {
  if (!storage) return;

  try {
    storage.setItem(localeStorageKey, locale);
  } catch {
    // A troca de idioma continua válida mesmo quando o armazenamento está indisponível.
  }
}

const initialLocale = readPersistedLocale(
  typeof window === 'undefined' ? undefined : window.localStorage,
);

export const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': ptBR,
    en,
  },
  lng: initialLocale,
  fallbackLng: fallbackLocale,
  defaultNS: 'common',
  supportedLngs: supportedLocales,
  interpolation: { escapeValue: false },
  initAsync: false,
  returnNull: false,
});

if (typeof document !== 'undefined') document.documentElement.lang = initialLocale;

export async function changeLocale(locale: SupportedLocale) {
  await i18n.changeLanguage(locale);
  persistLocale(typeof window === 'undefined' ? undefined : window.localStorage, locale);
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}
