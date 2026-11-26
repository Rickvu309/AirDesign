import { expect, it } from "vitest"
import { connectChoices, setupPromptOf, type ConnectChoice } from "@/copy/connect-agent-copy"

const choices: readonly ConnectChoice[] = connectChoices
const ways = choices.flatMap((choice) => choice.ways)

it("offers Claude, ChatGPT, Gemini and Other, in that order", () => {
  expect(choices.map((choice) => choice.name)).toEqual(["Claude", "ChatGPT", "Gemini", "Other"])
})

it("gives every coding agent a prompt and every app the address", () => {
  const kinds = Object.fromEntries(ways.map((way) => [way.tab, way.kind]))
  expect(kinds).toEqual({
    "Claude app": "address",
    "Claude Code": "prompt",
    "ChatGPT app": "address",
    Codex: "prompt",
    "Gemini app": "address",
    Antigravity: "prompt",
    Other: "address",
  })
})

it("names each way once", () => {
  expect(new Set(ways.map((way) => way.id)).size).toBe(ways.length)
})

it("opens an app's own page over https", () => {
  const links = ways.flatMap((way) => (way.kind === "address" && way.open ? [way.open.href] : []))
  expect(links).toEqual([
    "https://claude.ai/customize/connectors",
    "https://chatgpt.com/plugins",
    "https://gemini.google.com/apps",
  ])
})

it("writes the server's address into the prompt an agent is given", () => {
  expect(setupPromptOf("https://studio.airdesign.app/mcp")).toContain(" at https://studio.airdesign.app/mcp over HTTP")
})
