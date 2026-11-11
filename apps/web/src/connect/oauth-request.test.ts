import { describe, expect, it } from "vitest"
import { authorizationError, navigableAddress, oauthErrorRedirect } from "@/connect/oauth-request"

describe("authorization request", () => {
  it.each([
    ["response_type=token", "unsupported_response_type"],
    ["response_type=code", "invalid_request"],
    ["response_type=code&code_challenge=challenge&code_challenge_method=plain", "invalid_request"],
  ])("rejects %s before consent", (query, error) => {
    expect(authorizationError(new URLSearchParams(query))).toBe(error)
  })

  it("keeps the callback query and state when reporting an error", () => {
    const redirect = new URL(
      oauthErrorRedirect("https://client.example/callback?keep=yes", "access_denied", "state /&="),
    )

    expect(redirect.searchParams.get("keep")).toBe("yes")
    expect(redirect.searchParams.get("error")).toBe("access_denied")
    expect(redirect.searchParams.get("state")).toBe("state /&=")
  })
})

describe("navigable address", () => {
  it.each([
    [
      "https://client.example/callback?code=1&state=a%26b#frag",
      "https://client.example/callback?code=1&state=a%26b#frag",
    ],
    ["http://127.0.0.1:8123/cb?keep=1", "http://127.0.0.1:8123/cb?keep=1"],
    ["HTTPS://Client.Example/cb", "https://client.example/cb"],
    ["https:client.example/cb", "https://client.example/cb"],
    [" https://client.example/cb", "https://client.example/cb"],
  ])("sends %s to its absolute address", (address, destination) => {
    expect(navigableAddress(address)).toBe(destination)
  })

  it.each([
    "javascript:window.__pwn=1",
    "JaVaScRiPt:window.__pwn=1",
    " javascript:window.__pwn=1",
    "java\tscript:window.__pwn=1",
    "java\nscript:window.__pwn=1",
    "\u0001javascript:window.__pwn=1",
    "vbscript:msgbox(1)",
    "data:text/html,<script>window.__pwn=1</script>",
    "blob:https://client.example/id",
    "file:///etc/passwd",
    "about:blank",
    "ftp://client.example/cb",
    "ws://client.example/cb",
    "custom-app://cb",
    "//client.example/cb",
    "/sign-in",
    "callback",
    "",
  ])("refuses %j", (address) => {
    expect(navigableAddress(address)).toBeNull()
  })
})
