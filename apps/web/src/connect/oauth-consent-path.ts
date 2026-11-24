export function isOAuthConsentPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, "") || "/"
  return path === "/oauth/authorize"
}
