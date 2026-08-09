import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  type ExceptionFilter,
} from '@nestjs/common';
import type { OrganizationErrorResponse } from '@arcsyn-shift/contracts';
import type { FastifyReply } from 'fastify';
import { OrganizationsError } from '../../../organizations.error.js';
import {
  ORGANIZATIONS_ERROR_REPORTER,
  type OrganizationsErrorReporter,
} from '../helpers/organizations-error-reporter.js';

interface OrganizationHttpError {
  status: HttpStatus;
  body: OrganizationErrorResponse;
}

@Catch()
export class OrganizationsHttpExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(ORGANIZATIONS_ERROR_REPORTER)
    private readonly errorReporter: OrganizationsErrorReporter,
  ) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    if (error instanceof HttpException) {
      reply.status(error.getStatus()).send(error.getResponse());
      return;
    }

    if (error instanceof OrganizationsError) {
      const mapped = organizationHttpError(error.kind);
      reply.status(mapped.status).send(mapped.body);
      return;
    }

    this.errorReporter.report(error, {
      transport: 'http',
      category: 'organizations_unavailable',
    });
    const mapped = organizationHttpError('unavailable');
    reply.status(mapped.status).send(mapped.body);
  }
}

function organizationHttpError(kind: OrganizationsError['kind']): OrganizationHttpError {
  switch (kind) {
    case 'not_found':
      return {
        status: HttpStatus.NOT_FOUND,
        body: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organização não encontrada.' },
      };
    case 'forbidden':
      return {
        status: HttpStatus.FORBIDDEN,
        body: { code: 'ORGANIZATION_FORBIDDEN', message: 'Operação não permitida.' },
      };
    case 'conflict':
      return {
        status: HttpStatus.CONFLICT,
        body: {
          code: 'ORGANIZATION_CONFLICT',
          message: 'A operação entra em conflito com o estado atual.',
        },
      };
    case 'invitation_invalid':
      return {
        status: HttpStatus.NOT_FOUND,
        body: {
          code: 'ORGANIZATION_INVITATION_INVALID',
          message: 'Convite inválido ou indisponível.',
        },
      };
    case 'user_not_found':
      return {
        status: HttpStatus.NOT_FOUND,
        body: {
          code: 'ORGANIZATION_USER_NOT_FOUND',
          message: 'Conta destinatária não encontrada.',
        },
      };
    case 'unavailable':
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        body: {
          code: 'ORGANIZATION_UNAVAILABLE',
          message: 'Serviço de organizações indisponível.',
        },
      };
  }
}
