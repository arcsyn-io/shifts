import { Module } from '@nestjs/common';
import { createLogger } from '@arcsyn-shift/observability';
import { APPLICATION_ERROR_LOGGER, ErrorReporter } from './error-reporter.js';

@Module({
  providers: [
    {
      provide: APPLICATION_ERROR_LOGGER,
      useFactory: () => createLogger(process.env.LOG_LEVEL ?? 'info'),
    },
    ErrorReporter,
  ],
  exports: [ErrorReporter],
})
export class ErrorReportingModule {}
