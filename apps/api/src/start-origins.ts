import { readUrl } from "./resource.js"

const plainHost = /^[A-Za-z0-9.-]+$/

export function requireOrigin(name: string, value: string): void {
  const parsed = readUrl(value)
  if (parsed?.protocol !== "https:" || parsed.origin !== value) {
    throw new Error(`${name} is not an https origin`)
  }
}

export function requireDomain(cookieDomain: string | undefined): void {
  if (cookieDomain === undefined) return
  if (!plainHost.test(cookieDomain)) throw new Error("cookieDomain is not a plain host name")
}
