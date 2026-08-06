import { routes, type VercelConfig } from '@vercel/config/v1';

type Environment = Readonly<Record<string, string | undefined>>;

export function resolveApiProxyOrigin(environment: Environment): string {
  const configuredOrigin = environment.API_PROXY_ORIGIN?.trim();
  if (!configuredOrigin) {
    throw new Error('API_PROXY_ORIGIN must be configured with the API HTTPS origin');
  }
  if (configuredOrigin.includes('\\')) {
    throw new Error('API_PROXY_ORIGIN must be an exact HTTPS origin');
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(configuredOrigin);
  } catch {
    throw new Error('API_PROXY_ORIGIN must be an exact HTTPS origin');
  }

  if (parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== configuredOrigin) {
    throw new Error('API_PROXY_ORIGIN must be an exact HTTPS origin');
  }

  return parsedOrigin.origin;
}

export function createVercelConfig(environment: Environment): VercelConfig {
  const apiProxyOrigin = resolveApiProxyOrigin(environment);

  return {
    framework: 'vite',
    buildCommand: 'cd ../.. && pnpm exec turbo run build --filter=@arcsyn-shift/web',
    rewrites: [
      routes.rewrite('/api/:path*', `${apiProxyOrigin}/api/:path*`),
      routes.rewrite('/(.*)', '/index.html'),
    ],
  };
}

export const config = createVercelConfig(process.env);
