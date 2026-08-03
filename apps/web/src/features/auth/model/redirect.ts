interface LoginLocationState {
  from?: unknown;
}

export function isSafeInternalPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return false;
  }

  const hasControlCharacter = Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });

  if (value.includes('\\') || hasControlCharacter) return false;

  try {
    const parsed = new URL(value, 'https://arcsyn.invalid');
    return parsed.origin === 'https://arcsyn.invalid';
  } catch {
    return false;
  }
}

export function resolveLoginRedirect(state: unknown) {
  if (!state || typeof state !== 'object') return '/';

  const { from } = state as LoginLocationState;
  return isSafeInternalPath(from) ? from : '/';
}
