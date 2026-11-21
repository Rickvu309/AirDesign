import { describe, expect, it } from "vitest"
import { shortRef, toHtml, toMarkdown } from "./page.mjs"
import { readTree } from "./tree.mjs"

const { tree } = readTree(
  {
    kind: "assure",
    question: "Does before-after tell a failed base from a new state?",
    answer: {
      claim: "Before-after no longer calls a broken base new",
      group: { axis: "reasons", covers: "the old fault and the proof" },
      children: [
        {
          claim: "Any failure on <main> was labeled new",
          evidence: [{ ref: "look/before-after.mjs:180", source: "Observed", verdict: "passed" }],
        },
        {
          claim: "Three real runs show only the new state says new",
          evidence: [
            { ref: "https://github.com/o/r/releases/download/proof-4/run.png", source: "Observed", verdict: "open" },
          ],
        },
      ],
    },
  },
  { resolves: () => true },
)

describe("a logic page", () => {
  it("writes the decision, the question, the split and each branch with its evidence as Markdown", () => {
    expect(toMarkdown(tree)).toBe(
      [
        "**Result.** Before-after no longer calls a broken base new (Open)",
        "",
        "*Does before-after tell a failed base from a new state?*",
        "",
        "Split by reasons. Covers the old fault and the proof.",
        "",
        "- **A.** Any failure on <main> was labeled new (Passed)",
        "  - Observed, passed: `look/before-after.mjs:180`",
        "- **B.** Three real runs show only the new state says new (Open)",
        "  - Observed, open: [run.png](https://github.com/o/r/releases/download/proof-4/run.png)",
        "",
      ].join("\n"),
    )
  })

  it("draws one column per branch, shows the rolled-up verdict and escapes every claim", () => {
    const html = toHtml(tree)
    expect(html).toContain('style="--count:2"')
    expect(html).toContain(
      '<h1>Before-after no longer calls a broken base new <span class="verdict open">Open</span></h1>',
    )
    expect(html).toContain("Any failure on &lt;main&gt; was labeled new")
    expect(html).toContain("Evidence: Observed 2")
  })

  it("shortens a reference to what a reader recognises", () => {
    expect(shortRef(".agents/skills/verify-airdesign/look/before-after.mjs:180")).toBe("before-after.mjs:180")
    expect(shortRef("https://github.com/o/r/releases/download/proof-4/a%20b.png")).toBe("a b.png")
    expect(
      shortRef("https://github.com/o/r/releases/download/proof-4/branch-capture-outcomes-proof-2652c25e03.png"),
    ).toBe("…-proof-2652c25e03.png")
    expect(shortRef("look/a-very-long-file-name-for-a-test.mjs:180")).toBe("…me-for-a-test.mjs:180")
  })
})
