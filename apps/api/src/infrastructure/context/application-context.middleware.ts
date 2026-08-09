import type { IncomingMessage, ServerResponse } from 'node:http';
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import { ApplicationContext } from './application-context.js';

@Injectable()
export class ApplicationContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(ApplicationContext) private readonly applicationContext: ApplicationContext,
  ) {}

  use(_request: IncomingMessage, response: ServerResponse, next: () => void): void {
    this.applicationContext.runUntilClosed((close) => {
      response.once('finish', close);
      response.once('close', close);
      next();
    });
  }
}
