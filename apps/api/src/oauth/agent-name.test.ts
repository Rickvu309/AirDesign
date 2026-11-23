import { describe, expect, it } from "vitest"

import { agentNameOf } from "./clients.js"

describe("the name an agent's runs carry", () => {
  it("names known clients by their product, and any other by its own name", () => {
    expect(agentNameOf("Claude Code", "http://127.0.0.1:33418/callback")).toBe("Claude Code")
    expect(agentNameOf("Claude", "https://claude.ai/api/mcp/auth_callback")).toBe("Claude")
    expect(agentNameOf("Cursor", "https://cursor.example/callback")).toBe("Cursor")
  })

  it("drops control and format characters a client registered, caps the length, and falls back to its host", () => {
    expect(agentNameOf("‮Evil\u0007 Bot\n", "https://evil.example/cb")).toBe("Evil Bot")
    expect(agentNameOf("x".repeat(200), "https://long.example/cb")).toHaveLength(60)
    expect(agentNameOf("​\u0007", "https://blank.example/cb")).toBe("blank.example")
  })
})
