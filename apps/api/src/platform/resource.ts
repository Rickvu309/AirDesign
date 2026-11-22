export function readUrl(address: string, base?: string): URL | undefined {
  try {
    return new URL(address, base)
  } catch {
    return undefined
  }
}

function hrefOf(address: string): string | undefined {
  return readUrl(address)?.href
}

export function ownResource(given: unknown, own: string): boolean {
  if (given === undefined) return true
  if (typeof given !== "string") return false
  const left = hrefOf(given)
  return left !== undefined && left === hrefOf(own)
}

export function checkedResource(value: unknown): string {
  if (typeof value !== "string" || hrefOf(value)?.startsWith("https://") !== true) {
    throw new Error("ApiOptions.resource must be the server's own https: MCP address")
  }
  return value
}
