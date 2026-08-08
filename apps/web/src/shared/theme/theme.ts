import type { ThemeSwitcherTheme } from '@arcsyn-io/react';

export const supportedThemes = [
  'light',
  'dark',
  'deep-dark',
  'corporate-dark',
  'catppuccin-mocha',
  'catppuccin-latte',
] as const satisfies readonly ThemeSwitcherTheme[];

export type AppTheme = (typeof supportedThemes)[number];

export const defaultTheme: AppTheme = 'dark';
export const themeStorageKey = 'arcsyn-shift.theme';

interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ThemeDocument {
  documentElement: {
    setAttribute(name: string, value: string): void;
  };
}

export function isSupportedTheme(value: string | null | undefined): value is AppTheme {
  return supportedThemes.some((theme) => theme === value);
}

export function resolveTheme(value: string | null | undefined): AppTheme {
  return isSupportedTheme(value) ? value : defaultTheme;
}

export function readPersistedTheme(storage?: ThemeStorage): AppTheme {
  if (!storage) return defaultTheme;

  try {
    return resolveTheme(storage.getItem(themeStorageKey));
  } catch {
    return defaultTheme;
  }
}

export function persistTheme(storage: ThemeStorage | undefined, theme: AppTheme) {
  if (!storage) return;

  try {
    storage.setItem(themeStorageKey, theme);
  } catch {
    // O tema continua aplicado na sessão mesmo quando o armazenamento está indisponível.
  }
}

export function applyTheme(target: ThemeDocument | undefined, theme: AppTheme) {
  target?.documentElement.setAttribute('data-arcsyn-theme', theme);
}

export function initializeTheme(): AppTheme {
  const storage = typeof window === 'undefined' ? undefined : window.localStorage;
  const theme = readPersistedTheme(storage);
  applyTheme(typeof document === 'undefined' ? undefined : document, theme);
  return theme;
}

export function changeTheme(theme: AppTheme) {
  applyTheme(typeof document === 'undefined' ? undefined : document, theme);
  persistTheme(typeof window === 'undefined' ? undefined : window.localStorage, theme);
}
