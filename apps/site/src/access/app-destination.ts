import { readAccountCookie } from "@airdesign/catalog"

const placeholderOrigin = "https://placeholder.invalid"

function hasControlCharacterOrBackslash(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f || code === 0x5c) {
      return true
    }
  }
  return false
}

function resolvedOnOrigin(value: string): URL | null {
  try {
    const resolved = new URL(value, placeholderOrigin)
    return resolved.origin === placeholderOrigin ? resolved : null
  } catch {
    return null
  }
}

export function safeNextPath(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.startsWith("/") || hasControlCharacterOrBackslash(value)) {
    return "/"
  }
  const resolved = resolvedOnOrigin(value)
  if (resolved === null) {
    return "/"
  }
  const path = `${resolved.pathname}${resolved.search}`
  return resolvedOnOrigin(path) === null ? "/" : path
}

export function appDestination(appOrigin: string | undefined, next: string | null | undefined): string {
  return `${appOrigin ?? ""}${safeNextPath(next)}`
}

export function signedInDestination(cookie: string, appOrigin: string | undefined, search: string): string | null {
  if (!appOrigin || readAccountCookie(cookie) === undefined) {
    return null
  }
  return appDestination(appOrigin, new URLSearchParams(search).get("next"))
}
