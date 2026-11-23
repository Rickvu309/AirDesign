import { describe, expect, it } from "vitest"
import { compileAgentEdit } from "./agent-edit.js"
import { agentDeck, minter } from "./agent-fixtures.js"
import { readLinkAddress, readWrite } from "./index.js"
import { agent, ids, sampleDeck, textOf } from "./sample-deck.js"

const doom = sampleDeck()
const linked = (link: string) => ({ ...textOf("Revenue"), spans: [{ end: 7, link }] })

describe("a link goes to a web or mail address or a slide", () => {
  it("takes a link to an http, https or mailto address or a slide, and refuses any other scheme", () => {
    for (const link of ["https://example.com/a?b=1", "http://example.com", "mailto:jane@example.com", ids.slide]) {
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
    ]) {
      expect(readWrite({ node: ids.title, prop: "link", value: link }, doom)).toMatchObject({ refused: "shape" })
      expect(readWrite({ node: ids.title, prop: "text", value: linked(link) }, doom)).toMatchObject({
        refused: "shape",
      })
    }
  })

  it("refuses an agent's markdown link to a script", () => {
    const edit = compileAgentEdit(agentDeck(), [{ op: "set", target: ids.title, text: "[x](javascript:alert(1))" }], {
      author: agent("run-1"),
      once: "safe-1",
      mint: minter(),
    })
    expect(edit).toMatchObject({ refused: "shape" })
  })

  it("reads a typed web or mail address the way a link holds it, and never a slide id", () => {
    for (const address of ["https://example.com/a?b=1", "http://example.com", "mailto:jane@example.com"])
      expect(readLinkAddress(address)).toBe(address)
    for (const raw of [ids.slide, "example.com", "https://", "https://a b.com", "javascript:alert(1)", "", 7, null])
      expect(readLinkAddress(raw)).toBeUndefined()
    expect(readLinkAddress(`https://example.com/${"a".repeat(2_000)}`)).toBeUndefined()
  })
})
