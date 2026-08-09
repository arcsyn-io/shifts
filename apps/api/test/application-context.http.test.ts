import 'reflect-metadata';
import {
  CanActivate,
  Controller,
  Get,
  Inject,
  Injectable,
  MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
  UseGuards,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ApplicationContext,
  ApplicationContextAuthenticator,
} from '../src/infrastructure/context/application-context.js';
import { ApplicationContextMiddleware } from '../src/infrastructure/context/application-context.middleware.js';
import { ApplicationContextModule } from '../src/infrastructure/context/application-context.module.js';

const principal = {
  id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f',
  email: 'request@example.com',
};

@Injectable()
class ContextProbeGuard implements CanActivate {
  constructor(
    @Inject(ApplicationContextAuthenticator)
    private readonly authenticator: ApplicationContextAuthenticator,
  ) {}

  canActivate(): boolean {
    this.authenticator.setPrincipal(principal);
    return true;
  }
}

@Controller('context-probe')
class ContextProbeController {
  constructor(@Inject(ApplicationContext) private readonly context: ApplicationContext) {}

  @Get()
  @UseGuards(ContextProbeGuard)
  async get(): Promise<{ principalId: string }> {
    await Promise.resolve();
    return { principalId: this.context.getPrincipal().id };
  }
}

@Module({
  imports: [ApplicationContextModule],
  controllers: [ContextProbeController],
  providers: [ApplicationContextAuthenticator, ContextProbeGuard],
})
class ContextProbeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ApplicationContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

describe('ApplicationContext HTTP middleware', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      ContextProbeModule,
      new FastifyAdapter(),
      { logger: false },
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('opens the ALS store before guards and keeps it through the controller await', async () => {
    const response = await app.inject({ method: 'GET', url: '/context-probe' });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({ principalId: principal.id });
  });
});
