import { describe, expect, it } from 'vitest';
import { OrganizationsError } from '../src/modules/organizations/organizations.error.js';
import { OrganizationRepositoryError } from '../src/modules/organizations/repository/organizations.repository.js';

describe.each([
  [
    'OrganizationsError',
    (cause?: unknown, includeCause = true) =>
      new OrganizationsError('unavailable', includeCause ? { cause } : undefined),
  ],
  [
    'OrganizationRepositoryError',
    (cause?: unknown, includeCause = true) =>
      new OrganizationRepositoryError('unavailable', includeCause ? { cause } : undefined),
  ],
])('%s cause', (_name, createError) => {
  it('preserves the original cause without making it enumerable', () => {
    const cause = new Error('database unavailable');
    const error = createError(cause);

    expect((error as Error & { cause?: unknown }).cause).toBe(cause);
    expect(Object.getOwnPropertyDescriptor(error, 'cause')).toEqual({
      configurable: true,
      enumerable: false,
      value: cause,
      writable: true,
    });
    expect(error.name).toBe(_name);
    expect(error).toMatchObject({ kind: 'unavailable', message: 'unavailable' });
  });

  it('does not add cause when options are omitted', () => {
    const error = createError(undefined, false);

    expect(Object.prototype.hasOwnProperty.call(error, 'cause')).toBe(false);
  });

  it('preserves an explicitly undefined cause', () => {
    const error = createError(undefined);

    expect(Object.prototype.hasOwnProperty.call(error, 'cause')).toBe(true);
    expect(Object.getOwnPropertyDescriptor(error, 'cause')?.enumerable).toBe(false);
  });
});
