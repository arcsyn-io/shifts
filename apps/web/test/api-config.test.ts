import { describe, expect, it } from 'vitest';
import { resolveHealthApiUrl } from '@/shared/config/api';

describe('resolveHealthApiUrl', () => {
  it('keeps API requests relative when no base URL is configured', () => {
    expect(resolveHealthApiUrl('')).toBe('/api/health');
  });

  it('joins the fixed endpoint to a configured HTTP(S) origin', () => {
    expect(resolveHealthApiUrl(' https://api.example.com/ ')).toBe(
      'https://api.example.com/api/health',
    );
  });

  it.each([
    '//api.example.com',
    'https:\\api.example.com',
    'javascript:alert(1)',
    'https://user:password@api.example.com',
    'https://api.example.com/base-path',
    'https://api.example.com?tenant=one',
    'https://api.example.com#fragment',
  ])('rejects the unsafe base URL %s', (baseUrl) => {
    expect(() => resolveHealthApiUrl(baseUrl)).toThrow('Invalid VITE_API_URL');
  });
});
