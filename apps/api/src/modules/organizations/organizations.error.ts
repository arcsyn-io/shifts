export type OrganizationsErrorKind =
  'not_found' | 'forbidden' | 'conflict' | 'invitation_invalid' | 'user_not_found' | 'unavailable';

export class OrganizationsError extends Error {
  constructor(
    readonly kind: OrganizationsErrorKind,
    options?: ErrorOptions,
  ) {
    super(kind, options);
    this.name = 'OrganizationsError';
  }
}
