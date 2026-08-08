import { HttpException, HttpStatus } from '@nestjs/common';
import type { OrganizationErrorResponse } from '@arcsyn-shift/contracts';
import { OrganizationsError } from '../../../organizations.error.js';

export interface SafeParseSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

export class OrganizationValidationPipe<T> {
  constructor(private readonly schema: SafeParseSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new HttpException(
        {
          code: 'ORGANIZATION_INVALID_REQUEST',
          message: 'Dados da organização inválidos.',
        } satisfies OrganizationErrorResponse,
        HttpStatus.BAD_REQUEST,
      );
    }
    return result.data;
  }
}

export async function mapOrganizationsErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof OrganizationsError)) {
      throw organizationHttpError('unavailable');
    }
    throw organizationHttpError(error.kind);
  }
}

function organizationHttpError(kind: OrganizationsError['kind']): HttpException {
  switch (kind) {
    case 'not_found':
      return new HttpException(
        { code: 'ORGANIZATION_NOT_FOUND', message: 'Organização não encontrada.' },
        HttpStatus.NOT_FOUND,
      );
    case 'forbidden':
      return new HttpException(
        { code: 'ORGANIZATION_FORBIDDEN', message: 'Operação não permitida.' },
        HttpStatus.FORBIDDEN,
      );
    case 'conflict':
      return new HttpException(
        {
          code: 'ORGANIZATION_CONFLICT',
          message: 'A operação entra em conflito com o estado atual.',
        },
        HttpStatus.CONFLICT,
      );
    case 'invitation_invalid':
      return new HttpException(
        { code: 'ORGANIZATION_INVITATION_INVALID', message: 'Convite inválido ou indisponível.' },
        HttpStatus.NOT_FOUND,
      );
    case 'user_not_found':
      return new HttpException(
        { code: 'ORGANIZATION_USER_NOT_FOUND', message: 'Conta destinatária não encontrada.' },
        HttpStatus.NOT_FOUND,
      );
    case 'unavailable':
      return new HttpException(
        { code: 'ORGANIZATION_UNAVAILABLE', message: 'Serviço de organizações indisponível.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
  }
}
