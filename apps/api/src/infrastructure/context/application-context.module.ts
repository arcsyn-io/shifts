import { Global, Module } from '@nestjs/common';
import { ApplicationContext } from './application-context.js';
import { ApplicationContextMiddleware } from './application-context.middleware.js';

@Global()
@Module({
  providers: [
    ApplicationContext,
    ApplicationContextMiddleware,
  ],
  exports: [ApplicationContext, ApplicationContextMiddleware],
})
export class ApplicationContextModule {}
