import { describe, expect, it } from 'vitest';
import { createLoginRedirect, resolveSafeRedirect } from '@/features/auth/model/redirect';

describe('authentication redirects', () => {
  it('preserves the protected local destination', () => {
    expect(createLoginRedirect('/', '?view=week', '#today')).toBe(
      '/login?next=%2F%3Fview%3Dweek%23today',
    );
    expect(resolveSafeRedirect('?next=%2F%3Fview%3Dweek%23today')).toBe('/?view=week#today');
  });

  it.each([
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example/path',
    '/status',
    '/unknown',
  ])('falls back to root for the unrecognized destination %s', (destination) => {
    expect(resolveSafeRedirect(`?next=${encodeURIComponent(destination)}`)).toBe('/');
  });

  it('falls back to root when next is absent', () => {
    expect(resolveSafeRedirect('')).toBe('/');
  });
});
