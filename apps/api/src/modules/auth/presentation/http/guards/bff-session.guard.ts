import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  SetMetadata,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthError } from '../../../auth.error.js';
import {
  AUTH_CONFIG,
  GET_SESSION_USE_CASE,
  type AuthConfig,
  type GetSessionExecutor,
} from '../../../auth.tokens.js';
import {
  clearSessionCookies,
  createSessionCookies,
  readAuthCookies,
} from '../mappers/auth-cookies.mapper.js';

const AUTHENTICATED_PRINCIPAL = Symbol('AUTHENTICATED_PRINCIPAL');
const BFF_JSON_BODY = Symbol('BFF_JSON_BODY');

export const RequireBffJsonBody = () => SetMetadata(BFF_JSON_BODY, true);

export interface BffPrincipal {
  id: string;
  email: string;
}

type BffAuthenticatedRequest = FastifyRequest & {
  [AUTHENTICATED_PRINCIPAL]?: BffPrincipal;
};

@Injectable()
export class BffSessionGuard implements CanActivate {
  constructor(
    @Inject(GET_SESSION_USE_CASE) private readonly getSessionUseCase: GetSessionExecutor,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<BffAuthenticatedRequest>();
    const reply = http.getResponse<FastifyReply>();

    if (request.headers.authorization) {
      throw this.unauthorized();
    }

    try {
      const session = await this.getSessionUseCase.execute({
        ...readAuthCookies(this.config, request.headers.cookie),
        allowRefresh: this.hasTrustedSessionOrigin(request),
      });
      request[AUTHENTICATED_PRINCIPAL] = session.response.principal;
      if (session.renewedSession) {
        reply.header('Set-Cookie', createSessionCookies(this.config, session.renewedSession));
      }
      return true;
    } catch (error) {
      if (error instanceof AuthError && error.kind === 'invalid_session') {
        reply.header('Set-Cookie', clearSessionCookies(this.config));
      }
      throw this.toHttpError(error);
    }
  }

  private hasTrustedSessionOrigin(request: FastifyRequest): boolean {
    if (request.headers.origin) return request.headers.origin === this.config.webOrigin;
    return request.headers['sec-fetch-site'] === 'same-origin';
  }

  private toHttpError(error: unknown): HttpException {
    if (!(error instanceof AuthError) || error.kind === 'unavailable') {
      return new ServiceUnavailableException({
        code: 'AUTH_UNAVAILABLE',
        message: 'Serviço de autenticação indisponível.',
      });
    }
    if (error.kind === 'forbidden') {
      return new ForbiddenException({
        code: 'AUTH_FORBIDDEN',
        message: 'Origem não permitida.',
      });
    }
    return this.unauthorized();
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_UNAUTHORIZED',
      message: 'Sessão inválida ou expirada.',
    });
  }
}

@Injectable()
export class BffMutationGuard implements CanActivate {
  constructor(
    @Inject(BffSessionGuard) private readonly sessionGuard: BffSessionGuard,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (request.headers.origin !== this.config.webOrigin) {
      throw new ForbiddenException({
        code: 'AUTH_FORBIDDEN',
        message: 'Origem não permitida.',
      });
    }
    if (this.reflector.get<boolean>(BFF_JSON_BODY, context.getHandler())) {
      const contentType = request.headers['content-type'];
      if (
        !contentType ||
        contentType.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json'
      ) {
        throw new HttpException(
          {
            code: 'ORGANIZATION_INVALID_REQUEST',
            message: 'Content-Type deve ser application/json.',
          },
          415,
        );
      }
    }
    return this.sessionGuard.canActivate(context);
  }
}

export const AuthenticatedPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): BffPrincipal => {
    const request = context.switchToHttp().getRequest<BffAuthenticatedRequest>();
    const principal = request[AUTHENTICATED_PRINCIPAL];
    if (!principal) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Sessão inválida ou expirada.',
      });
    }
    return principal;
  },
);
