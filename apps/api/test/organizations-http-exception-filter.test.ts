import 'reflect-metadata';
import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OrganizationsError } from '../src/modules/organizations/organizations.error.js';
import { OrganizationsHttpExceptionFilter } from '../src/modules/organizations/presentation/http/filters/organizations-http-exception.filter.js';

function createHarness() {
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  const reporter = { report: vi.fn() };
  const filter = new OrganizationsHttpExceptionFilter(reporter);
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { filter, host, reporter, send, status };
}

describe('OrganizationsHttpExceptionFilter', () => {
  it.each([
    ['not_found', 404, 'ORGANIZATION_NOT_FOUND', 'Organização não encontrada.'],
    ['forbidden', 403, 'ORGANIZATION_FORBIDDEN', 'Operação não permitida.'],
    ['conflict', 409, 'ORGANIZATION_CONFLICT', 'A operação entra em conflito com o estado atual.'],
    [
      'invitation_invalid',
      404,
      'ORGANIZATION_INVITATION_INVALID',
      'Convite inválido ou indisponível.',
    ],
    ['user_not_found', 404, 'ORGANIZATION_USER_NOT_FOUND', 'Conta destinatária não encontrada.'],
    ['unavailable', 503, 'ORGANIZATION_UNAVAILABLE', 'Serviço de organizações indisponível.'],
  ] as const)('maps %s to the stable HTTP contract', (kind, statusCode, code, message) => {
    const harness = createHarness();

    harness.filter.catch(new OrganizationsError(kind), harness.host);

    expect(harness.status).toHaveBeenCalledWith(statusCode);
    expect(harness.send).toHaveBeenCalledWith({ code, message });
    expect(harness.reporter.report).not.toHaveBeenCalled();
  });

  it('preserves transport exceptions raised by guards and pipes', () => {
    const harness = createHarness();
    const body = { code: 'ORGANIZATION_INVALID_REQUEST', message: 'Dados inválidos.' };

    harness.filter.catch(new HttpException(body, HttpStatus.BAD_REQUEST), harness.host);

    expect(harness.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(harness.send).toHaveBeenCalledWith(body);
    expect(harness.reporter.report).not.toHaveBeenCalled();
  });

  it('sanitizes and reports an unexpected technical failure once', () => {
    const harness = createHarness();
    const error = new Error('canary-secret');

    harness.filter.catch(error, harness.host);

    expect(harness.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(harness.send).toHaveBeenCalledWith({
      code: 'ORGANIZATION_UNAVAILABLE',
      message: 'Serviço de organizações indisponível.',
    });
    expect(JSON.stringify(harness.send.mock.calls)).not.toContain('canary-secret');
    expect(harness.reporter.report).toHaveBeenCalledOnce();
    expect(harness.reporter.report).toHaveBeenCalledWith(error, {
      transport: 'http',
      category: 'organizations_unavailable',
    });
  });
});
