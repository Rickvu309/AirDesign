import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { refusedText } from "./text-refused"

const node = doom.nodeId("s:4")
const draft = doom.textFromMarkdown("Words worth keeping", "body")
const sent = { node, draft, onces: ["a-1", "a-2"] }

describe("a refused text commit", () => {
  it("is found when a notice names one of the session's sent edits", () => {
    expect(refusedText([{ once: "a-2" }], sent)).toEqual({ node, draft, only: true })
    expect(refusedText([{ once: "a-1" }, { once: "b-1" }], sent)).toEqual({ node, draft, only: false })
  })

  it("is not found for other edits' notices or with nothing sent", () => {
    expect(refusedText([{ once: "b-1" }], sent)).toBeNull()
    expect(refusedText([{ once: "a-1" }], null)).toBeNull()
  })
})
