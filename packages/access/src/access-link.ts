export function accessLinkPath(token: string): string {
  return `/access/link?token=${encodeURIComponent(token)}`
}

export function readAccessLinkToken(location: { pathname: string; search: string }): string | null {
  if (location.pathname !== "/access/link") {
    return null
  }
  const token = new URLSearchParams(location.search).get("token")
  if (!token) {
    return null
  }
  return token
}
