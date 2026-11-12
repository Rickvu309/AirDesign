import { accountCookieName, sessionCookieName } from "@airdesign/catalog"
import { findAccess } from "./account.js"
import type { Sql } from "./pool.js"

export const keptSeconds = 2592000

function withDomain(cookie: string, cookieDomain?: string): string {
  return cookieDomain === undefined ? cookie : `${cookie}; Domain=${cookieDomain}`
}

function sessionCookieHeader(value: string, maxAge: number, cookieDomain?: string): string {
  return withDomain(
    `${sessionCookieName}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${String(maxAge)}`,
    cookieDomain,
  )
}

export function sessionCookie(token: string, cookieDomain?: string): string {
  return sessionCookieHeader(encodeURIComponent(token), keptSeconds, cookieDomain)
}

export function accountCookie(device: string, maxAge: number, cookieDomain?: string): string {
  return withDomain(
    `${accountCookieName}=${device}; Secure; SameSite=Lax; Path=/; Max-Age=${String(maxAge)}`,
    cookieDomain,
  )
}

export function clearSessionCookie(cookieDomain?: string): readonly string[] {
  return [sessionCookieHeader("", 0, cookieDomain), accountCookie("", 0, cookieDomain)]
}

export async function signedInCookies(
  session: Sql,
  cookieDomain: string | undefined,
  token: string,
): Promise<readonly string[]> {
  const access = await findAccess(session, token)
  const cookie = sessionCookie(token, cookieDomain)
  if (access === undefined) return [cookie]
  return [cookie, accountCookie(access.device, keptSeconds, cookieDomain)]
}
