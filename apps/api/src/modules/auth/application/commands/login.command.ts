export interface LoginCommand {
  readonly email: string;
  readonly password: string;
  readonly clientAddress: string;
  readonly correlationId: string;
}
