import { Inject, Injectable } from '@nestjs/common';

export const APPLICATION_ERROR_LOGGER = Symbol('APPLICATION_ERROR_LOGGER');

export interface ApplicationErrorLogger {
  error(bindings: object, message: string): void;
}

export interface ApplicationErrorReport {
  transport: 'http' | 'mcp';
  category: 'organizations_unavailable' | 'mcp_tool_failure';
}

@Injectable()
export class ErrorReporter {
  constructor(@Inject(APPLICATION_ERROR_LOGGER) private readonly logger: ApplicationErrorLogger) {}

  report(_error: unknown, report: ApplicationErrorReport): void {
    this.logger.error(report, 'Application request failed');
  }
}
