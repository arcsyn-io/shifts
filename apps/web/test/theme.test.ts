import { describe, expect, it } from 'vitest';
import {
  applyTheme,
  defaultTheme,
  persistTheme,
  readPersistedTheme,
  resolveTheme,
  supportedThemes,
  themeStorageKey,
} from '../src/shared/theme/theme';

describe('theme preferences', () => {
  it('tracks every theme published by the design-system contract', () => {
    expect(supportedThemes).toEqual([
      'light',
      'dark',
      'deep-dark',
      'corporate-dark',
      'catppuccin-mocha',
      'catppuccin-latte',
    ]);
  });

  it('uses dark for absent or unsupported preferences', () => {
    expect(defaultTheme).toBe('dark');
    expect(resolveTheme(undefined)).toBe('dark');
    expect(resolveTheme('unknown')).toBe('dark');
  });

  it('reads and persists a supported theme', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(readPersistedTheme(storage)).toBe('dark');
    persistTheme(storage, 'catppuccin-mocha');
    expect(values.get(themeStorageKey)).toBe('catppuccin-mocha');
    expect(readPersistedTheme(storage)).toBe('catppuccin-mocha');
  });

  it('applies the theme through the design-system document attribute', () => {
    const attributes = new Map<string, string>();
    const target = {
      documentElement: {
        setAttribute: (name: string, value: string) => attributes.set(name, value),
      },
    };

    applyTheme(target, 'light');
    expect(attributes.get('data-arcsyn-theme')).toBe('light');
  });
});
