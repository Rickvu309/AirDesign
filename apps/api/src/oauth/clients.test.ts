import { describe, expect, it } from "vitest"

import { readRegistration, screenFor, type Screen } from "./clients.js"
import { checkedResource, ownResource } from "../platform/resource.js"
import { geminiCallback, geminiRegistration } from "./testing/gemini-registration.js"

const claudeCallback = "https://claude.ai/api/mcp/auth_callback"

describe("screen for a client", () => {
  const table: readonly (readonly [string, string | null, string, Screen])[] = [
    ["the exact claude.ai callback with no name", null, claudeCallback, "claude"],
    ["the exact claude.com callback with no name", null, "https://claude.com/api/mcp/auth_callback", "claude"],
    ["the exact callback whatever the name", "Something else", claudeCallback, "claude"],
    ["a client named Claude on another host", "Claude", "https://evil.example/cb", "other"],
    ["a claude callback with an extra path", null, `${claudeCallback}/extra`, "other"],
    ["a claude callback with a query", null, `${claudeCallback}?next=1`, "other"],
    ["a claude callback on a different host", null, "https://claude.ai.evil.example/api/mcp/auth_callback", "other"],
    ["a claude callback with other credentials", null, "https://user@claude.ai/api/mcp/auth_callback", "other"],
    ["Claude Code on localhost", "Claude Code", "http://localhost:4000/cb", "claude-code"],
    [
      "Claude Code on 127.0.0.1 in any case and spaces",
      "  claude CODE (dev) ",
      "http://127.0.0.1:4000/cb",
      "claude-code",
    ],
    ["Claude Code on [::1]", "Claude Code", "http://[::1]:4000/cb", "claude-code"],
    ["Claude Code with an https address", "Claude Code", "https://example.com/cb", "other"],
    ["Claude without Code on loopback", "Claude", "http://localhost:4000/cb", "other"],
    ["Codex on loopback", "Codex", "http://127.0.0.1:5000/cb", "codex"],
    ["Codex CLI on localhost in any case", " CODEX CLI", "http://localhost:5000/cb", "codex"],
    ["Codex on a public host", "Codex", "https://example.com/cb", "other"],
    ["Claude Code on a javascript address", "Claude Code", "javascript://localhost/%0aalert(1)", "other"],
    ["Codex on a javascript address", "Codex", "javascript://127.0.0.1/%0aalert(1)", "other"],
    ["no name on loopback", null, "http://localhost:4000/cb", "other"],
    ["a loopback lookalike host", "Claude Code", "http://localhost.evil.example/cb", "other"],
    ["a name that only contains Codex", "My Codex", "http://localhost:4000/cb", "other"],
    ["a Google relay callback whatever the name", "Claude Code", geminiCallback, "gemini"],
    ["a Google relay callback with no name", null, geminiCallback, "gemini"],
    [
      "the Google sandbox relay on /a/",
      null,
      "https://oauth-redirect-sandbox.googleusercontent.com/a/x-1_y.z",
      "gemini",
    ],
    ["the Google test relay on /r/", null, "https://oauth-redirect-test.googleusercontent.com/r/x", "gemini"],
    ["a Google relay with a query", null, `${geminiCallback}?next=1`, "other"],
    ["a Google relay over http", null, geminiCallback.replace("https:", "http:"), "other"],
    ["a Google relay on another port", null, geminiCallback.replace(".com/", ".com:8443/"), "other"],
    ["a Google relay with credentials", null, geminiCallback.replace("https://", "https://user@"), "other"],
    ["a Google relay in capitals", null, geminiCallback.replace("oauth-redirect", "OAUTH-REDIRECT"), "other"],
    ["a Google relay lookalike host", null, "https://oauth-redirect.googleusercontent.com.evil.example/r/x", "other"],
    ["another googleusercontent host", null, "https://evil.googleusercontent.com/r/x", "other"],
    ["a Google relay on another path", null, "https://oauth-redirect.googleusercontent.com/x/abc", "other"],
    ["a Google relay with no id", null, "https://oauth-redirect.googleusercontent.com/r/", "other"],
    ["a Google relay with a deeper path", null, "https://oauth-redirect.googleusercontent.com/r/a/b", "other"],
  ]

  it.each(table)("%s", (_label, name, address, screen) => {
    expect(screenFor({ name, redirectUris: [address] }, address)).toBe(screen)
  })

  it("is Gemini for each of the six redirects Gemini registers", () => {
    const client = { name: geminiRegistration.client_name, redirectUris: geminiRegistration.redirect_uris }
    for (const used of geminiRegistration.redirect_uris) expect(screenFor(client, used)).toBe("gemini")
  })

  it("is not Gemini when one registered redirect is not a Google relay", () => {
    const client = { name: "Google", redirectUris: [...geminiRegistration.redirect_uris, "https://evil.example/cb"] }
    expect(screenFor(client, geminiCallback)).toBe("other")
    expect(screenFor(client, "https://evil.example/cb")).toBe("other")
  })
})

describe("the server's own address", () => {
  it("matches after parsing and nothing else", () => {
    const own = "https://mcp.example.test/mcp"
    expect(ownResource(undefined, own)).toBe(true)
    expect(ownResource("https://mcp.example.test/mcp", own)).toBe(true)
    expect(ownResource("https://MCP.example.test:443/mcp", own)).toBe(true)
    expect(ownResource("https://mcp.example.test/mcp/", own)).toBe(false)
    expect(ownResource("https://mcp.example.test:8443/mcp", own)).toBe(false)
    expect(ownResource("http://mcp.example.test/mcp", own)).toBe(false)
    expect(ownResource("not a url", own)).toBe(false)
    expect(ownResource("", own)).toBe(false)
    expect(ownResource(7, own)).toBe(false)
    expect(ownResource(null, own)).toBe(false)
  })
})

describe("the configured address", () => {
  it("is returned when it is an https address", () => {
    expect(checkedResource("https://mcp.example.test/mcp")).toBe("https://mcp.example.test/mcp")
  })

  it("throws naming resource when missing or not https", () => {
    for (const value of [
      undefined,
      "",
      "http://localhost/mcp",
      "mcp.example.test/mcp",
      "ftp://mcp.example.test/mcp",
      7,
    ]) {
      expect(() => checkedResource(value)).toThrow(/resource/)
    }
  })
})

describe("a registration", () => {
  it("reads Gemini's six Google redirects", () => {
    expect(readRegistration(geminiRegistration)).toEqual({
      ok: true,
      redirectUris: geminiRegistration.redirect_uris,
      name: "Google",
    })
  })

  it("refuses more than ten redirects", () => {
    const uris = Array.from({ length: 11 }, (_, index) => `https://example.com/${String(index)}`)
    expect(readRegistration({ redirect_uris: uris })).toEqual({ ok: false, refusal: "invalid_client_metadata" })
    expect(readRegistration({ redirect_uris: uris.slice(1) })).toMatchObject({ ok: true })
  })
})
