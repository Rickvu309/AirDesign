import { describe, expect, it } from "vitest"

import { agentNameOf } from "./clients.js"
import { geminiCallback, geminiRegistration } from "./testing/gemini-registration.js"

const one = (name: string | null, address: string) => agentNameOf({ name, redirectUris: [address] }, address)

describe("the name an agent's runs carry", () => {
  it("names known clients by their product, and any other by its own name", () => {
    expect(one("Claude Code", "http://127.0.0.1:33418/callback")).toBe("Claude Code")
    expect(one("Claude", "https://claude.ai/api/mcp/auth_callback")).toBe("Claude")
    expect(one("Cursor", "https://cursor.example/callback")).toBe("Cursor")
    const gemini = { name: geminiRegistration.client_name, redirectUris: geminiRegistration.redirect_uris }
    expect(agentNameOf(gemini, geminiCallback)).toBe("Gemini")
  })

  it("drops control and format characters a client registered, caps the length, and falls back to its host", () => {
    expect(one("‮Evil\u0007 Bot\n", "https://evil.example/cb")).toBe("Evil Bot")
    expect(one("x".repeat(200), "https://long.example/cb")).toHaveLength(60)
    expect(one("​\u0007", "https://blank.example/cb")).toBe("blank.example")
  })
})
