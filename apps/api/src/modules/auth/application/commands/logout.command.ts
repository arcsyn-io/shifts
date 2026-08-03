export interface LogoutCommand {
  readonly refreshToken?: string;
  readonly accessToken?: string;
  readonly correlationId: string;
}
