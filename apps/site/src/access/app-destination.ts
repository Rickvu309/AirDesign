export function safeNextPath(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/"
  }
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return "/"
  }
  return value
}

export function appDestination(appOrigin: string | undefined, next: string | null | undefined): string {
  return `${appOrigin ?? ""}${safeNextPath(next)}`
}
