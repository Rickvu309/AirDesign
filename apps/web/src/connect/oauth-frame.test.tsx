import { expect, it } from "vitest"
import headers from "../../public/_headers?raw"
import { isOAuthConsentPath } from "./oauth-consent-path"

function headersFor(pathname: string) {
  const lines = headers.split("\n")
  const start = lines.indexOf(pathname)
  if (start === -1) return []
  const end = lines.findIndex((line, index) => index > start && !line.startsWith("  "))
  return lines.slice(start + 1, end === -1 ? undefined : end).map((line) => line.trim())
}

it.each(["/oauth/authorize", "/oauth/authorize/"])("%s serves the consent page and refuses a frame", (pathname) => {
  expect(isOAuthConsentPath(pathname)).toBe(true)
  expect(headersFor(pathname)).toEqual(["Content-Security-Policy: frame-ancestors 'none'", "X-Frame-Options: DENY"])
})

it.each([
  "/oauth/authorize//",
  "//oauth/authorize",
  "/oauth/authorize/x",
  "/oauth/authorize.html",
  "/oauth/authorize%2F",
  "/oauth/authoriz%65",
  "/OAuth/authorize",
])("%s does not serve the consent page", (pathname) => {
  expect(isOAuthConsentPath(pathname)).toBe(false)
})
