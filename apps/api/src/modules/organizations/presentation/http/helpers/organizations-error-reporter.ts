export const ORGANIZATIONS_ERROR_REPORTER = Symbol('ORGANIZATIONS_ERROR_REPORTER');

export interface OrganizationsErrorReporter {
  report(
    error: unknown,
    report: { transport: 'http'; category: 'organizations_unavailable' },
  ): void;
}
