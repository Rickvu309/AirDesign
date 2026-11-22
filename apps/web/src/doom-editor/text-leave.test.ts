import { doom } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { blankTextFor, holdsPaint, leaveEmptyWrites } from "./text-leave"
import { grow, paint, spot } from "./doom-fixtures"

const blank = doom.textFromMarkdown("", "body")
const words = doom.textFromMarkdown("Hello", "body")
const json = (text: doom.Text) => JSON.stringify(text)
const node = "n:1" as doom.NodeId

describe("what leaving an edit with no words writes", () => {
  it("removes a bare text box that was emptied", () => {
    expect(leaveEmptyWrites({ node, keeps: false, draft: blank, pushed: json(words) })).toEqual([
      { node, prop: "parent", value: null },
    ])
  })

  it("keeps a painted shape and clears the words it had saved", () => {
    expect(leaveEmptyWrites({ node, keeps: true, draft: blank, pushed: json(words) })).toEqual([
      { node, prop: "text", value: blank },
    ])
  })

  it("writes nothing for a painted shape that never had words", () => {
    expect(leaveEmptyWrites({ node, keeps: true, draft: blank, pushed: json(blank) })).toEqual([])
  })

  it("writes nothing while there are words to save", () => {
    expect(leaveEmptyWrites({ node, keeps: false, draft: words, pushed: json(blank) })).toEqual([])
  })
})

describe("which shapes are more than a text box", () => {
  const built = grow([
    { type: "shape", name: "card", props: { box: spot(100, 100, 300, 200), fills: paint } },
    { type: "shape", name: "words", props: { box: spot(500, 100, 300, 200) } },
  ])

  it("counts a fill or a stroke, not a bare box", () => {
    expect(holdsPaint(built.view, built.ids.card!)).toBe(true)
    expect(holdsPaint(built.view, built.ids.words!)).toBe(false)
  })
})

describe("the words a shape starts with", () => {
  it("keeps a painted shape's size and centres its words", () => {
    const text = blankTextFor(true)
    expect(text).toMatchObject({ chars: "", resize: "fixed", alignV: "center", paras: [{ align: "center" }] })
    expect(doom.isRefusal(doom.props.text.read(text))).toBe(false)
  })

  it("lets a bare text box grow with its words", () => {
    expect(blankTextFor(false)).toMatchObject({ chars: "", resize: "height", alignV: "top" })
  })
})
