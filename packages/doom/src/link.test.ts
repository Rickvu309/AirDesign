import { describe, expect, it } from "vitest"
import { compileIntents } from "./intent-edit.js"
import { agentDeck, minter } from "./testing/agent-fixtures.js"
import { readLinkAddress } from "./index.js"
import { readWrite } from "./read-write.js"
import { agent, ids, sampleDeck, textOf } from "./sample-deck.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

const doom = sampleDeck()
const linked = (link: string) => ({ ...textOf("Revenue"), spans: [{ end: 7, link }] })
const atLimit = `https://example.com/${"a".repeat(1_980)}`
const betweenLimits = `https://example.com/${"a".repeat(2_000)}`

describe("a link goes to a web or mail address or a slide", () => {
  it("takes a link to an http, https or mailto address or a slide, and refuses any other scheme", () => {
    for (const link of [
      "https://example.com/a?b=1",
      "http://example.com",
      "mailto:jane@example.com",
      "mailto:a@b.c",
      "mailto:a@b.c?subject=x",
      atLimit,
      ids.slide,
    ]) {
      expect(readWrite({ node: ids.title, prop: "link", value: link }, doom)).toMatchObject({ value: link })
      expect(readWrite({ node: ids.title, prop: "text", value: linked(link) }, doom)).not.toHaveProperty("refused")
    }
    for (const link of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,x",
      "file:///etc/passwd",
      "vbscript:x",
      "example.com",
      "https://",
      "mailto:",
      "mailto:?x",
    ]) {
      expect(readWrite({ node: ids.title, prop: "link", value: link }, doom)).toMatchObject({ refused: "shape" })
      expect(readWrite({ node: ids.title, prop: "text", value: linked(link) }, doom)).toMatchObject({
        refused: "shape",
      })
    }
    expect(readWrite({ node: ids.title, prop: "link", value: betweenLimits }, doom)).toMatchObject({
      refused: "limit",
    })
    expect(readWrite({ node: ids.title, prop: "text", value: linked(betweenLimits) }, doom)).toMatchObject({
      refused: "limit",
    })
  })

  it("refuses an agent's markdown link to a script, bare mailto query, or address over the limit", () => {
    for (const [link, refused] of [
      ["javascript:alert(1)", "shape"],
      ["mailto:?x", "shape"],
      [betweenLimits, "limit"],
    ] as const) {
      const edit = compileIntents(agentDeck(), [{ op: "update", target: ids.title, text: `[x](${link})` }], {
        placement,
        starts,
        author: agent("run-1"),
        once: "safe-1",
        mint: minter(),
      })
      expect(edit).toMatchObject({ refused })
    }
    for (const link of ["mailto:a@b.c", "mailto:a@b.c?subject=x", atLimit]) {
      const edit = compileIntents(agentDeck(), [{ op: "update", target: ids.title, text: `[x](${link})` }], {
        placement,
        starts,
        author: agent("run-1"),
        once: "safe-1",
        mint: minter(),
      })
      expect(edit).not.toHaveProperty("refused")
    }
  })

  it("reads a typed web or mail address the way a link holds it, and never a slide id", () => {
    for (const address of [
      "https://example.com/a?b=1",
      "http://example.com",
      "mailto:jane@example.com",
      "mailto:a@b.c",
      "mailto:a@b.c?subject=x",
      atLimit,
    ])
      expect(readLinkAddress(address)).toBe(address)
    for (const raw of [
      ids.slide,
      "example.com",
      "https://",
      "https://a b.com",
      "mailto:",
      "mailto:?x",
      "javascript:alert(1)",
      betweenLimits,
      "",
      7,
      null,
    ])
      expect(readLinkAddress(raw)).toBeUndefined()
  })
})
