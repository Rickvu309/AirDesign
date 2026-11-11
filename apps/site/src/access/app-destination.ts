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

function staysOnOrigin(value: string): boolean {
  return new URL(value, placeholderOrigin).origin === placeholderOrigin
}

export function safeNextPath(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.startsWith("/") || hasControlCharacterOrBackslash(value)) {
    return "/"
  }
  if (!staysOnOrigin(value)) {
    return "/"
  }
  const resolved = new URL(value, placeholderOrigin)
  const path = `${resolved.pathname}${resolved.search}`
  return staysOnOrigin(path) ? path : "/"
}

export function appDestination(appOrigin: string | undefined, next: string | null | undefined): string {
  return `${appOrigin ?? ""}${safeNextPath(next)}`
}
