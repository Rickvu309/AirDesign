import { describe, expect, it } from "vitest"
import { authorizationError, oauthErrorRedirect } from "@/connect/oauth-request"

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
