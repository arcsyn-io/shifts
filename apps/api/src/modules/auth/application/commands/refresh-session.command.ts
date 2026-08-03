export interface RefreshSessionCommand {
  readonly refreshToken: string;
  readonly csrfToken: string;
  readonly clientAddress: string;
  readonly correlationId: string;
}
