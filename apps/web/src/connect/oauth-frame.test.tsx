import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, expect, it, vi } from "vitest"
import App from "@/App"
import headers from "../../public/_headers?raw"

vi.mock("@/connect/oauth-authorize", () => ({ OAuthAuthorize: () => "consent page" }))

afterEach(() => {
  vi.unstubAllGlobals()
})

function paintsConsent(pathname: string) {
  vi.stubGlobal("window", { location: { pathname } })
  return renderToStaticMarkup(<App />) === "consent page"
}

function headersFor(pathname: string) {
  const lines = headers.split("\n")
  const start = lines.indexOf(pathname)
  if (start === -1) return []
  const end = lines.findIndex((line, index) => index > start && !line.startsWith("  "))
  return lines.slice(start + 1, end === -1 ? undefined : end).map((line) => line.trim())
}

it.each(["/oauth/authorize", "/oauth/authorize/"])("%s paints the consent page and refuses a frame", (pathname) => {
  expect(paintsConsent(pathname)).toBe(true)
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
])("%s does not paint the consent page", (pathname) => {
  expect(paintsConsent(pathname)).toBe(false)
})
