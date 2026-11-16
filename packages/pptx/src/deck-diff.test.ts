import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { deckDiff, partDiff } from "./deck-diff.js"
import { encodeUtf8 as text } from "./package-bytes.js"

const slide = (title: string, x: number) =>
  text(
    `<?xml version="1.0" encoding="UTF-8"?><p:sld><p:cSld><p:spTree>` +
      `<p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr>` +
      `<p:sp><p:nvSpPr><p:cNvPr id="4" name="Title"/></p:nvSpPr>` +
      `<p:spPr><a:xfrm><a:off x="${x}" y="914400"/></a:xfrm></p:spPr>` +
      `<p:txBody><a:p><a:r><a:t>Intro</a:t></a:r></a:p><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>` +
      `</p:spTree></p:cSld></p:sld>`,
  )

const deck = (title: string, x: number): Map<string, Uint8Array> =>
  new Map([
    ["[Content_Types].xml", text("<Types/>")],
    ["ppt/presentation.xml", text("<p:presentation/>")],
    ["ppt/slides/slide1.xml", slide(title, x)],
    ["ppt/media/image1.png", Uint8Array.of(1, 2, 3)],
  ])

describe("deckDiff", () => {
  it("an untouched part is counted as byte-identical and a changed slide is named", () => {
    const before = deck("Old title", 914400)
    const after = new Map(before)
    after.set("ppt/slides/slide1.xml", slide("New title", 914400))
    after.delete("ppt/media/image1.png")
    after.set("ppt/media/image2.png", Uint8Array.of(4))
    expect(deckDiff(before, after)).toEqual({
      changed: ["ppt/slides/slide1.xml"],
      added: ["ppt/media/image2.png"],
      removed: ["ppt/media/image1.png"],
      same: 2,
      orderMoved: false,
    })
  })

  it("a moved part order is reported", () => {
    const before = deck("Old title", 914400)
    const after = new Map([...before].reverse())
    expect(deckDiff(before, after)).toMatchObject({ changed: [], same: 4, orderMoved: true })
    expect(deckDiff(before, new Map(before)).orderMoved).toBe(false)
  })
})

describe("partDiff", () => {
  it("a changed run's text is shown with its shape path", () => {
    const shape = "p:sld/p:cSld/p:spTree[id=1]/p:sp[id=4]"
    const found = partDiff("ppt/slides/slide1.xml", slide("Old title", 914400), slide("New title", 1828800))
    expect(found).toMatchObject({ part: "ppt/slides/slide1.xml", kind: "xml", more: 0 })
    expect(found.lines).toEqual([
      { at: `${shape}/p:spPr/a:xfrm/a:off`, op: "-", text: '<a:off x="914400" y="914400">' },
      { at: `${shape}/p:spPr/a:xfrm/a:off`, op: "+", text: '<a:off x="1828800" y="914400">' },
      { at: `${shape}/p:txBody/a:p[2]/a:r/a:t`, op: "-", text: "Old title" },
      { at: `${shape}/p:txBody/a:p[2]/a:r/a:t`, op: "+", text: "New title" },
    ])
  })

  it("caps the lines at the limit and counts the rest", () => {
    const found = partDiff("ppt/slides/slide1.xml", slide("Old title", 914400), slide("New title", 1828800), 3)
    expect(found.lines).toHaveLength(3)
    expect(found.more).toBe(1)
  })

  it("reports only the sizes of a part that is not markup", () => {
    expect(partDiff("ppt/media/image1.png", Uint8Array.of(1, 2, 3), Uint8Array.of(4))).toEqual({
      part: "ppt/media/image1.png",
      kind: "binary",
      before: 3,
      after: 1,
      lines: [],
      more: 0,
    })
  })
})

const words = (list: readonly string[]) => text(`<r>${list.map((word) => `<a:p v="${word}"/>`).join("")}</r>`)

function common(left: readonly string[], right: readonly string[]): number {
  const row = Array.from({ length: right.length + 1 }, () => 0)
  for (const word of left) {
    let diagonal = 0
    for (let index = 1; index <= right.length; index += 1) {
      const above = row[index] ?? 0
      row[index] = word === right[index - 1] ? diagonal + 1 : Math.max(above, row[index - 1] ?? 0)
      diagonal = above
    }
  }
  return row[right.length] ?? 0
}

it("removes and adds only the lines outside the longest common run, and an inserted paragraph is one line", () => {
  const word = fc.constantFrom("a", "b", "c", "d")
  fc.assert(
    fc.property(fc.array(word, { maxLength: 30 }), fc.array(word, { maxLength: 30 }), (left, right) => {
      const { lines } = partDiff("ppt/slides/slide1.xml", words(left), words(right), Number.MAX_SAFE_INTEGER)
      const kept = common(left, right)
      expect(lines.filter((line) => line.op === "-")).toHaveLength(left.length - kept)
      expect(lines.filter((line) => line.op === "+")).toHaveLength(right.length - kept)
    }),
  )
  const inserted = partDiff("ppt/slides/slide1.xml", words(["a", "b", "c"]), words(["a", "d", "b", "c"]))
  expect(inserted.lines).toEqual([{ at: "r/a:p[2]", op: "+", text: '<a:p v="d">' }])
})
