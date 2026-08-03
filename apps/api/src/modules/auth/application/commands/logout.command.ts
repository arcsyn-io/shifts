export interface LogoutCommand {
  readonly refreshToken: string;
  readonly correlationId: string;
}
