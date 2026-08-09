import { HttpException, HttpStatus } from '@nestjs/common';
import type { OrganizationErrorResponse } from '@arcsyn-shift/contracts';

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
