const HEALTH_ENDPOINT = '/api/health';
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function resolveHealthApiUrl(configuredBaseUrl = import.meta.env.VITE_API_URL) {
  const baseUrl = configuredBaseUrl?.trim();

  if (!baseUrl) return HEALTH_ENDPOINT;
  if (baseUrl.includes('\\')) throw new Error('Invalid VITE_API_URL');

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new Error('Invalid VITE_API_URL');
  }

  const hasUnexpectedParts =
    !ALLOWED_PROTOCOLS.has(parsedBaseUrl.protocol) ||
    parsedBaseUrl.username !== '' ||
    parsedBaseUrl.password !== '' ||
    parsedBaseUrl.pathname !== '/' ||
    parsedBaseUrl.search !== '' ||
    parsedBaseUrl.hash !== '';

  if (hasUnexpectedParts) throw new Error('Invalid VITE_API_URL');

  return `${parsedBaseUrl.origin}${HEALTH_ENDPOINT}`;
}
