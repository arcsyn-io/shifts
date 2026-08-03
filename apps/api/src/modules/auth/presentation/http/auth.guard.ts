import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AppConfig } from '@arcsyn-shift/config';
import type { AppLogger } from '@arcsyn-shift/observability';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AUTH_CONFIG, AUTH_LOGGER } from '../../auth.tokens.js';
import { AuthService } from '../../application/auth.service.js';
import type { VerifiedAccessResult } from '../../application/results/auth-session.result.js';
import {
  AUTH_PUBLIC_METADATA,
  AUTH_REQUIRE_CSRF_METADATA,
  AUTH_SKIP_ORIGIN_METADATA,
} from './auth.metadata.js';
import { getAuthCookieNames, parseCookies } from './auth.cookies.js';

export interface AuthenticatedRequest extends FastifyRequest {
  auth?: VerifiedAccessResult;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CREDENTIAL_KEYS = new Set(['accesstoken', 'authorization', 'jwt', 'token']);
const MAX_INSPECTION_DEPTH = 6;
const MAX_INSPECTION_NODES = 128;
const MAX_INSPECTED_STRING_LENGTH = 8192;
const JWT_LIKE_PATTERN = /^[A-Za-z0-9_-]{2,2048}\.[A-Za-z0-9_-]{2,4096}\.[A-Za-z0-9_-]{0,2048}$/;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AppConfig,
    @Inject(AUTH_LOGGER) private readonly logger: AppLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const correlationId = String(request.id);
    if ((request.headers.authorization ?? '').trim().length > 0) {
      this.logRejection('auth.transport', 'authorization_header', correlationId);
      throw new UnauthorizedException({ code: 'authorization_not_supported' });
    }
    if (this.containsCredential(request.query) || this.containsCredential(request.body)) {
      this.logRejection('auth.transport', 'token_outside_cookie', correlationId);
      throw new UnauthorizedException({ code: 'token_transport_not_supported' });
    }

    const skipOrigin = this.getMetadata(context, AUTH_SKIP_ORIGIN_METADATA);
    const isMutating = MUTATING_METHODS.has(request.method.toUpperCase());
    if (isMutating && !skipOrigin) this.assertAllowedOrigin(request.headers.origin, correlationId);

    const cookies = parseCookies(request.headers.cookie);
    const cookieNames = getAuthCookieNames(this.config);
    const csrfToken = cookies[cookieNames.csrf];
    const csrfHeader = request.headers['x-csrf-token'];
    const requireCsrf = this.getMetadata(context, AUTH_REQUIRE_CSRF_METADATA);
    if (requireCsrf) this.assertDoubleSubmitCsrf(csrfToken, csrfHeader, correlationId);

    if (this.getMetadata(context, AUTH_PUBLIC_METADATA)) return true;

    const accessToken = cookies[cookieNames.access];
    if (!accessToken) {
      this.logRejection('auth.session', 'missing_access', correlationId);
      throw new UnauthorizedException({ code: 'authentication_required' });
    }
    const access = await this.authService.verifyAccessToken(accessToken);
    if (!access) {
      this.logRejection('auth.session', 'invalid_access', correlationId);
      throw new UnauthorizedException({ code: 'invalid_session' });
    }

    if (isMutating) {
      this.assertDoubleSubmitCsrf(csrfToken, csrfHeader, correlationId);
      if (!csrfToken || !this.authService.csrfMatchesAccess(csrfToken, access)) {
        this.logRejection('auth.csrf', 'session_mismatch', correlationId);
        throw new ForbiddenException({ code: 'invalid_csrf' });
      }
    }
    request.auth = access;
    return true;
  }

  private getMetadata(context: ExecutionContext, key: string): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]) ===
      true
    );
  }

  private assertAllowedOrigin(origin: string | undefined, correlationId: string): void {
    let normalizedOrigin: string;
    try {
      normalizedOrigin = origin ? new URL(origin).origin : '';
    } catch {
      normalizedOrigin = '';
    }
    if (normalizedOrigin !== new URL(this.config.WEB_URL).origin) {
      this.logRejection('auth.origin', 'origin_mismatch', correlationId);
      throw new ForbiddenException({ code: 'invalid_origin' });
    }
  }

  private assertDoubleSubmitCsrf(
    cookieToken: string | undefined,
    headerToken: string | string[] | undefined,
    correlationId: string,
  ): void {
    if (!cookieToken || typeof headerToken !== 'string' || cookieToken !== headerToken) {
      this.logRejection('auth.csrf', 'double_submit_mismatch', correlationId);
      throw new ForbiddenException({ code: 'invalid_csrf' });
    }
  }

  private logRejection(event: string, reason: string, correlationId: string): void {
    this.logger.warn(
      { event, result: 'rejected', reason, correlationId },
      'Authentication request rejected',
    );
  }

  private containsCredential(value: unknown): boolean {
    const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
    const visited = new WeakSet<object>();
    let inspectedNodes = 0;

    while (pending.length > 0) {
      const current = pending.pop();
      if (!current) break;
      inspectedNodes += 1;
      if (inspectedNodes > MAX_INSPECTION_NODES || current.depth > MAX_INSPECTION_DEPTH)
        return true;

      if (typeof current.value === 'string') {
        if (current.value.length > MAX_INSPECTED_STRING_LENGTH) return true;
        if (JWT_LIKE_PATTERN.test(current.value)) return true;
        continue;
      }
      if (!current.value || typeof current.value !== 'object') continue;
      if (visited.has(current.value)) continue;
      visited.add(current.value);

      if (Array.isArray(current.value)) {
        for (const item of current.value) pending.push({ value: item, depth: current.depth + 1 });
        continue;
      }

      for (const [key, nestedValue] of Object.entries(current.value)) {
        const normalizedKey = key.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
        if (CREDENTIAL_KEYS.has(normalizedKey)) return true;
        pending.push({ value: nestedValue, depth: current.depth + 1 });
      }
    }
    return false;
  }
}
