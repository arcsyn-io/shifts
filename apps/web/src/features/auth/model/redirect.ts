const DEFAULT_DESTINATION = '/';
const RECOGNIZED_PROTECTED_PATHS = new Set(['/']);

export function resolveSafeRedirect(search: string): string {
  const candidate = new URLSearchParams(search).get('next');

  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return DEFAULT_DESTINATION;
  }

  if (candidate.includes('\\')) return DEFAULT_DESTINATION;

  try {
    const destination = new URL(candidate, 'https://app.arcsyn.invalid');

    if (!RECOGNIZED_PROTECTED_PATHS.has(destination.pathname)) {
      return DEFAULT_DESTINATION;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return DEFAULT_DESTINATION;
  }
}

export function createLoginRedirect(pathname: string, search: string, hash: string): string {
  const destination = `${pathname}${search}${hash}`;
  return `/login?next=${encodeURIComponent(destination)}`;
}
