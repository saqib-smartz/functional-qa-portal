/**
 * Share tokens are `randomBytes(32).toString("base64url")` (43 chars), but the bound is kept loose so
 * older or future token lengths still resolve. The point is to reject junk path segments before they
 * reach Mongo, not to re-derive the generator.
 */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;

export function isShareToken(value: string): boolean {
  return SHARE_TOKEN_PATTERN.test(value);
}
