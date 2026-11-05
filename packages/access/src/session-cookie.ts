import { serializeSignedCookie } from "better-call"
import { decodePathSegment } from "./decode-path-segment.ts"

const sessionCookie = "better-auth.session_token"
const intentCookie = "airdesign.intent"

export function sessionCookieName(secure: boolean): string {
  return secure ? `__Secure-${sessionCookie}` : sessionCookie
}

export function intentCookieName(secure: boolean): string {
  return secure ? `__Secure-${intentCookie}` : intentCookie
}

export function readRequestCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie")
  if (!header) {
    return null
  }
  for (const part of header.split(";")) {
    const trimmed = part.trim()
    const splitAt = trimmed.indexOf("=")
    if (splitAt <= 0) {
      continue
    }
    if (trimmed.slice(0, splitAt) !== name) {
      continue
    }
    return decodePathSegment(trimmed.slice(splitAt + 1))
  }
  return null
}

export async function sessionSetCookie(secret: string, token: string, secure: boolean, maxAge: number): Promise<string> {
  return serializeSignedCookie(sessionCookieName(secure), token, secret, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge,
  })
}

export function intentSetCookie(token: string, secure: boolean, maxAge: number): string {
  const parts = [
    `${intentCookieName(secure)}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ]
  if (secure) {
    parts.push("Secure")
  }
  return parts.join("; ")
}

export function headerCookies(headers: Headers): string[] {
  return headers.getSetCookie()
}
