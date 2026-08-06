import {
  authErrorResponseSchema,
  authSessionResponseSchema,
  loginRequestSchema,
  type AuthErrorResponse,
  type AuthSessionResponse,
  type LoginRequest,
} from '@arcsyn-shift/contracts';

const SESSION_ENDPOINT = '/api/auth/session';
const LOGIN_ENDPOINT = '/api/auth/login';

export class AuthRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

async function readError(response: Response): Promise<AuthErrorResponse | undefined> {
  try {
    const body: unknown = await response.json();
    const parsed = authErrorResponseSchema.safeParse(body);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

async function throwAuthError(response: Response): Promise<never> {
  const error = await readError(response);
  throw new AuthRequestError(response.status, error?.message ?? 'Authentication unavailable');
}

export async function fetchSession(signal?: AbortSignal): Promise<AuthSessionResponse> {
  const response = await fetch(SESSION_ENDPOINT, {
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) return throwAuthError(response);

  const body: unknown = await response.json();
  return authSessionResponseSchema.parse(body);
}

export async function login(credentials: LoginRequest): Promise<AuthSessionResponse> {
  const body = loginRequestSchema.parse(credentials);
  const response = await fetch(LOGIN_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) return throwAuthError(response);

  const responseBody: unknown = await response.json();
  return authSessionResponseSchema.parse(responseBody);
}
