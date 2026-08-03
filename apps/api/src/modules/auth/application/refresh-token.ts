const REFRESH_TOKEN_PATTERN =
  /^(?<id>[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(?<secret>[A-Za-z0-9_-]{43})$/i;

export const parseRefreshToken = (token: string): { id: string } | null => {
  const match = REFRESH_TOKEN_PATTERN.exec(token);
  return match?.groups?.id ? { id: match.groups.id } : null;
};
