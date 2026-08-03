import { describe, expect, it } from 'vitest';
import { isSafeInternalPath, resolveLoginRedirect } from '@/features/auth/model/redirect';

describe('post-login redirect', () => {
  it.each(['/shifts', '/shifts?view=week', '/settings#profile'])(
    'accepts the internal destination %s',
    (destination) => {
      expect(isSafeInternalPath(destination)).toBe(true);
      expect(resolveLoginRedirect({ from: destination })).toBe(destination);
    },
  );

  it.each([
    'https://malicious.example',
    '//malicious.example',
    '/\\malicious.example',
    'javascript:alert(1)',
    '',
    null,
    undefined,
  ])('falls back to home for the unsafe destination %s', (destination) => {
    expect(resolveLoginRedirect({ from: destination })).toBe('/');
  });

  it('falls back to home for invalid router state', () => {
    expect(resolveLoginRedirect(null)).toBe('/');
    expect(resolveLoginRedirect('not-an-object')).toBe('/');
  });
});
