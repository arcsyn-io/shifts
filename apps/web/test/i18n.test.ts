import { describe, expect, it } from 'vitest';
import {
  defaultLocale,
  fallbackLocale,
  i18n,
  localeStorageKey,
  persistLocale,
  readPersistedLocale,
  resolveLocale,
} from '../src/shared/i18n/i18n';
import { en } from '../src/shared/i18n/resources/en';
import { ptBR } from '../src/shared/i18n/resources/pt-BR';

function collectLeafKeys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'object' && child !== null ? collectLeafKeys(child, path) : [path];
  });
}

describe('internationalization foundation', () => {
  it('defaults safely to pt-BR and uses en as fallback', () => {
    expect(defaultLocale).toBe('pt-BR');
    expect(fallbackLocale).toBe('en');
    expect(resolveLocale(undefined)).toBe('pt-BR');
    expect(resolveLocale('fr')).toBe('pt-BR');
    expect(resolveLocale('en')).toBe('en');
    expect(i18n.options.fallbackLng).toContain('en');
  });

  it('keeps the pt-BR and en catalogs structurally aligned', () => {
    expect(collectLeafKeys(ptBR).sort()).toEqual(collectLeafKeys(en).sort());
  });

  it('reads and persists a supported locale without depending on browser storage', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(readPersistedLocale(storage)).toBe('pt-BR');
    persistLocale(storage, 'en');
    expect(values.get(localeStorageKey)).toBe('en');
    expect(readPersistedLocale(storage)).toBe('en');
  });

  it('changes translated copy without reloading', async () => {
    await i18n.changeLanguage('pt-BR');
    expect(i18n.t('form.submit', { ns: 'auth' })).toBe('Entrar');

    await i18n.changeLanguage('en');
    expect(i18n.t('form.submit', { ns: 'auth' })).toBe('Sign in');

    await i18n.changeLanguage(defaultLocale);
  });
});
