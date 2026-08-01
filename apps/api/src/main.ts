import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { loadConfig } from '@arcsyn-shift/config';
import { createLogger } from '@arcsyn-shift/observability';
import { AppModule } from './app.module.js';
import { DATABASE_POOL } from './infrastructure/database/database.module.js';
import type { Pool } from 'pg';

export async function bootstrap() {
  const config = loadConfig();
  const port = config.PORT ?? config.API_PORT;
  const logger = createLogger(config.LOG_LEVEL);
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });
  await app.get<Pool>(DATABASE_POOL).query('select 1');
  app.setGlobalPrefix('api', { exclude: [{ path: 'mcp', method: RequestMethod.ALL }] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: config.WEB_URL });
  app.enableShutdownHooks();
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ArcSyn Shift API')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  await app.listen(port, '0.0.0.0');
  logger.info({ port, mcp: config.MCP_ENABLED }, 'API started');
  return app;
}

if (process.env.NODE_ENV !== 'test') void bootstrap();
