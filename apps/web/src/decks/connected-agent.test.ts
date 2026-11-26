import { expect, it } from "vitest"
import { agentLabel, agentMark, type ConnectedAgent } from "@/decks/connected-agent"

const row = (agent: ConnectedAgent["agent"], name: string | null): ConnectedAgent => ({
  id: "grant",
  name,
  agent,
  host: "oauth-redirect.googleusercontent.com",
  connected: "2026-11-26T00:00:00.000Z",
})

it("names a Gemini grant Gemini with the Gemini mark, whatever name its client registered", () => {
  expect(agentLabel(row("gemini", "Google"))).toBe("Gemini")
  expect(agentMark(row("gemini", "Google"))).toBe("gemini")
})

it("names any other grant by its client name, or its host when it has none", () => {
  expect(agentLabel(row("other", "Google"))).toBe("Google")
  expect(agentLabel(row("other", null))).toBe("oauth-redirect.googleusercontent.com")
  expect(agentMark(row("other", "Google"))).toBe("other")
})
