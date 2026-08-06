import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  loginRequestSchema,
  type AuthErrorResponse,
  type AuthSessionResponse,
  type LoginRequest,
} from '@arcsyn-shift/contracts';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthError } from '../../auth.error.js';
import {
  AUTH_CONFIG,
  GET_SESSION_USE_CASE,
  LOGIN_USE_CASE,
  LOGOUT_USE_CASE,
  type AuthConfig,
  type GetSessionExecutor,
  type LoginExecutor,
  type LogoutExecutor,
} from '../../auth.tokens.js';
import {
  clearSessionCookies,
  createSessionCookies,
  readAuthCookies,
} from './mappers/auth-cookies.mapper.js';

const NO_STORE = 'private, no-store';

class LoginBodyPipe {
  transform(value: unknown): LoginRequest {
    const result = loginRequestSchema.safeParse(value);
    if (!result.success) {
      throw new HttpException(
        { code: 'AUTH_INVALID_REQUEST', message: 'Dados de login inválidos.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return result.data;
  }
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(LOGIN_USE_CASE) private readonly loginUseCase: LoginExecutor,
    @Inject(GET_SESSION_USE_CASE) private readonly getSessionUseCase: GetSessionExecutor,
    @Inject(LOGOUT_USE_CASE) private readonly logoutUseCase: LogoutExecutor,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Create a Supabase-backed browser session' })
  @ApiBody({ schema: { type: 'object', required: ['email', 'password'] } })
  @ApiResponse({ status: 200, description: 'Public principal for the created session' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body(new LoginBodyPipe()) body: LoginRequest,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionResponse> {
    this.assertMutationOrigin(request);
    this.assertJsonContentType(request);
    try {
      const session = await this.loginUseCase.execute(body);
      reply.header('Set-Cookie', createSessionCookies(this.config, session));
      return { principal: session.principal };
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  @Get('session')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Validate and, when needed, renew the browser session' })
  @ApiResponse({ status: 200, description: 'Public principal for the current session' })
  @ApiResponse({ status: 401, description: 'Session is absent or invalid' })
  async session(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionResponse> {
    if (request.headers.authorization) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Sessão inválida ou expirada.',
      });
    }
    try {
      const result = await this.getSessionUseCase.execute({
        ...readAuthCookies(this.config, request.headers.cookie),
        allowRefresh: this.hasTrustedSessionOrigin(request),
      });
      if (result.renewedSession) {
        reply.header('Set-Cookie', createSessionCookies(this.config, result.renewedSession));
      }
      return result.response;
    } catch (error) {
      if (error instanceof AuthError && error.kind === 'invalid_session') {
        reply.header('Set-Cookie', clearSessionCookies(this.config));
      }
      throw this.toHttpError(error);
    }
  }

  @Delete('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Revoke and clear the browser session' })
  @ApiResponse({ status: 204, description: 'Session cleared' })
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    this.assertMutationOrigin(request);
    try {
      await this.logoutUseCase.execute(readAuthCookies(this.config, request.headers.cookie));
    } catch (error) {
      throw this.toHttpError(error);
    } finally {
      reply.header('Set-Cookie', clearSessionCookies(this.config));
    }
  }

  private assertMutationOrigin(request: FastifyRequest): void {
    const origin = request.headers.origin;
    if (!origin || origin !== this.config.webOrigin) {
      const response: AuthErrorResponse = {
        code: 'AUTH_FORBIDDEN',
        message: 'Origem não permitida.',
      };
      throw new ForbiddenException(response);
    }
  }

  private hasTrustedSessionOrigin(request: FastifyRequest): boolean {
    if (request.headers.origin) return request.headers.origin === this.config.webOrigin;
    return request.headers['sec-fetch-site'] !== 'cross-site';
  }

  private assertJsonContentType(request: FastifyRequest): void {
    const contentType = request.headers['content-type'];
    if (!contentType || contentType.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
      throw new HttpException(
        { code: 'AUTH_INVALID_REQUEST', message: 'Content-Type deve ser application/json.' },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }
  }

  private toHttpError(error: unknown): HttpException {
    if (!(error instanceof AuthError) || error.kind === 'unavailable') {
      return new ServiceUnavailableException({
        code: 'AUTH_UNAVAILABLE',
        message: 'Serviço de autenticação indisponível.',
      });
    }
    if (error.kind === 'invalid_credentials') {
      return new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Credenciais inválidas.',
      });
    }
    if (error.kind === 'forbidden') {
      return new ForbiddenException({
        code: 'AUTH_FORBIDDEN',
        message: 'Origem não permitida.',
      });
    }
    return new UnauthorizedException({
      code: 'AUTH_UNAUTHORIZED',
      message: 'Sessão inválida ou expirada.',
    });
  }
}
