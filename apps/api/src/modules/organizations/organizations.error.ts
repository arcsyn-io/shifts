export type OrganizationsErrorKind =
  'not_found' | 'forbidden' | 'conflict' | 'invitation_invalid' | 'user_not_found' | 'unavailable';

interface ErrorCauseOptions {
  cause?: unknown;
}

export class OrganizationsError extends Error {
  constructor(
    readonly kind: OrganizationsErrorKind,
    options?: ErrorCauseOptions,
  ) {
    super(kind);
    this.name = 'OrganizationsError';
    if (options && Object.prototype.hasOwnProperty.call(options, 'cause')) {
      Object.defineProperty(this, 'cause', {
        configurable: true,
        value: options.cause,
        writable: true,
      });
    }
  }
}
