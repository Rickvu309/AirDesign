import { deckDiffArgs, deckDiffReport } from "./deck-diff.mjs"

const slide = "ppt/slides/slide4.xml"
const at = "p:sld/p:cSld/p:spTree[id=1]/p:sp[id=4]/p:txBody/a:p/a:r/a:t"
const pptx = (found) => ({
  deckDiff: () => ({ changed: [], added: [], removed: [], same: 212, orderMoved: false, ...found }),
  partDiff: (part) => ({
    part,
    kind: "xml",
    before: 18204,
    after: 18377,
    lines: [
      { at, op: "-", text: "Old title" },
      { at, op: "+", text: "New title" },
    ],
    more: 3,
  }),
})
const parts = new Map([["ppt/media/image1.png", Uint8Array.of(1, 2)]])
const report = (found, allow) =>
  deckDiffReport(pptx(found), parts, parts, { allow, limit: 200, names: { before: "a.pptx", after: "b.pptx" } })
const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const outside = report({ changed: [slide] }, ["ppt/presentation.xml"])
same("a change outside --allow exits 1", [outside.failed, outside.outside], [true, [slide]])
same("the report shows the part, its path and lines", outside.lines, [
  "deck-diff a.pptx -> b.pptx: 1 changed, 0 added, 0 removed, 212 byte-identical, part order kept",
  `changed ${slide} (18,204 -> 18,377 bytes)`,
  `  ${at}`,
  "  - Old title",
  "  + New title",
  "  and 3 more",
  `outside --allow: ${slide}`,
])

same("a change inside --allow exits 0", report({ changed: [slide] }, [slide]).failed, false)
same("without --allow it only reports", report({ changed: [slide] }, null).failed, false)
same("a moved part order is outside --allow", report({ orderMoved: true }, [slide]).outside, ["part order"])
const removed = report({ removed: ["ppt/media/image1.png"] }, [])
same(
  "a removed part is outside --allow",
  [removed.failed, removed.lines.at(-2)],
  [true, "removed ppt/media/image1.png (2 bytes)"],
)
same("an untouched deck shows 0 changed", report({}, [slide]).lines, [
  "deck-diff a.pptx -> b.pptx: 0 changed, 0 added, 0 removed, 212 byte-identical, part order kept",
  "outside --allow: none",
])

same("--allow repeats and --limit is read", deckDiffArgs(["a", "b", "--allow", "x", "--allow", "y", "--limit", "5"]), {
  before: "a",
  after: "b",
  allow: ["x", "y"],
  json: false,
  limit: 5,
})
let refused = ""
try {
  deckDiffArgs(["a.pptx", "b.pptx", "--everything"])
} catch (error) {
  refused = error.message
}
if (!refused.includes("--everything")) throw new Error("an unknown flag is refused")
