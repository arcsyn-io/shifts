import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { AppConfig } from '@arcsyn-shift/config';
import {
  loginRequestSchema,
  type AuthSessionResponse,
  type LoginRequest,
} from '@arcsyn-shift/contracts';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { AUTH_CONFIG } from '../../auth.tokens.js';
import { AuthError, AuthService } from '../../application/auth.service.js';
import { PublicRoute, RequireCsrf } from './auth.metadata.js';
import type { AuthenticatedRequest } from './auth.guard.js';
import {
  clearSessionCookies,
  createSessionCookies,
  getAuthCookieNames,
  parseCookies,
} from './auth.cookies.js';
import { ZodBodyPipe } from './zod-body.pipe.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, no-store')
  @PublicRoute()
  @ApiOperation({ summary: 'Create a local authenticated session' })
  @ApiBody({ schema: { type: 'object', required: ['email', 'password'] } })
  @ApiResponse({ status: 200, description: 'Session created' })
  async login(
    @Body(new ZodBodyPipe(loginRequestSchema)) body: LoginRequest,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionResponse> {
    try {
      const session = await this.authService.login({
        email: body.email,
        password: body.password,
        clientAddress: request.ip,
        correlationId: String(request.id),
      });
      reply.header('set-cookie', createSessionCookies(this.config, session));
      return this.authService.toResponse(session, session.csrfToken);
    } catch (error) {
      this.rethrowAuthError(error, 'invalid_credentials');
    }
  }

  @Get('session')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Read the current authenticated session' })
  @ApiResponse({ status: 200, description: 'Current session' })
  session(@Req() request: AuthenticatedRequest): AuthSessionResponse {
    const csrfToken = parseCookies(request.headers.cookie)[getAuthCookieNames(this.config).csrf];
    if (!request.auth || !csrfToken) throw new UnauthorizedException({ code: 'invalid_session' });
    return this.authService.toResponse(request.auth, csrfToken);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, no-store')
  @PublicRoute()
  @RequireCsrf()
  @ApiOperation({ summary: 'Rotate the refresh token and renew the access session' })
  @ApiResponse({ status: 200, description: 'Session refreshed' })
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionResponse> {
    const cookies = parseCookies(request.headers.cookie);
    const names = getAuthCookieNames(this.config);
    const csrfToken = cookies[names.csrf];
    const refreshToken = cookies[names.refresh];
    if (!csrfToken || !refreshToken) throw new UnauthorizedException({ code: 'invalid_session' });
    try {
      const session = await this.authService.refresh({
        refreshToken,
        csrfToken,
        clientAddress: request.ip,
        correlationId: String(request.id),
      });
      reply.header('set-cookie', createSessionCookies(this.config, session));
      return this.authService.toResponse(session, session.csrfToken);
    } catch (error) {
      reply.header('set-cookie', clearSessionCookies(this.config));
      this.rethrowAuthError(error, 'invalid_session');
    }
  }

  @Delete('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'private, no-store')
  @PublicRoute()
  @ApiOperation({ summary: 'Revoke and clear the current session' })
  @ApiResponse({ status: 204, description: 'Session cleared' })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const cookies = parseCookies(request.headers.cookie);
    const names = getAuthCookieNames(this.config);
    const refreshToken = cookies[names.refresh];
    const correlationId = String(request.id);
    if (refreshToken) await this.authService.logout({ refreshToken, correlationId });
    else {
      const accessToken = cookies[names.access];
      if (accessToken) await this.authService.logoutByAccessToken(accessToken, correlationId);
    }
    reply.header('set-cookie', clearSessionCookies(this.config));
  }

  private rethrowAuthError(error: unknown, unauthorizedCode: string): never {
    if (!(error instanceof AuthError)) throw error;
    if (error.code === 'rate_limited') {
      throw new HttpException({ code: error.code }, HttpStatus.TOO_MANY_REQUESTS);
    }
    throw new UnauthorizedException({ code: unauthorizedCode });
  }
}
