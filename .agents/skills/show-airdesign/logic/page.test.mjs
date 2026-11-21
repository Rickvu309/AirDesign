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
        "  - `look/before-after.mjs:180` (passed)",
        "- **B.** Three real runs show only the new state says new (Open)",
        "  - [run.png](https://github.com/o/r/releases/download/proof-4/run.png) (open)",
        "",
      ].join("\n"),
    )
  })

  it("draws a lean tree to skim: claims and marks only, headers by axis, the first photo embedded in its box", () => {
    const html = toHtml(tree)
    const order = ["Before-after no longer calls", "Any failure on &lt;main&gt;", "Three real runs show"].map((text) =>
      html.indexOf(text),
    )
    expect(order.every((at, index) => at > 0 && (index === 0 || at > order[index - 1]))).toBe(true)
    expect(html).toContain('<span class="mark open">○ Open</span>')
    expect(html.match(/class="box d1/g)).toHaveLength(2)
    expect(html).toContain('class="box d1 with-photo"')
    expect(html).toContain(">Reasons</div>")
    expect(html).toContain('<img class="thumb" src="https://github.com/o/r/releases/download/proof-4/run.png"')
    for (const left of ["The old fault and the proof", "Observed", "before-after.mjs", "verdict"])
      expect(html).not.toContain(left)
  })

  it("shows a picture once even when several claims rest on it", () => {
    const shared = readTree(
      {
        kind: "assure",
        question: "Does every screen get one honest label?",
        answer: {
          claim: "Every screen now gets one honest label",
          group: { axis: "reasons", covers: "every way a screen can turn out" },
          children: ["Shown when the screen loaded", "New when main never had it"].map((claim) => ({
            claim,
            evidence: [{ ref: "https://example.test/proof.png", source: "Observed", verdict: "passed" }],
          })),
        },
      },
      { resolves: () => true },
    ).tree
    expect(toHtml(shared).match(/class="thumb"/g)).toHaveLength(1)
    shared.children[1].evidence.unshift({
      ref: "https://example.test/proof.png",
      source: "Observed",
      verdict: "passed",
    })
    shared.children[1].evidence[1] = { ref: "https://example.test/second.png", source: "Observed", verdict: "passed" }
    expect(toHtml(shared)).toContain('src="https://example.test/second.png"')
  })

  it("marks the chosen option of a decision and greys the options it beat", () => {
    const plan = readTree(
      {
        kind: "decide",
        question: "How should the picture label a broken screen?",
        answer: {
          claim: "Call it failed and keep new for real new screens",
          group: { axis: "options", covers: "every label it could get" },
          children: [
            { claim: "Keep calling every such screen new", evidence: [{ ref: "a.md", source: "Observed" }] },
            { claim: "Call it failed unless it is new", evidence: [{ ref: "b.md", source: "Proposal" }], chosen: true },
          ],
        },
      },
      { resolves: () => true },
    ).tree
    const html = toHtml(plan)
    expect(html).toContain('<div class="box d1 passed-over"><span class="badge">A</span>')
    expect(html).toContain(
      '<div class="box d1 unbuilt chosen"><span class="badge">B</span><span class="tag">Chosen</span>',
    )
    expect(toMarkdown(plan)).toContain("- **B.** Call it failed unless it is new (chosen)")
    plan.children[1].detail = "Main's own list of screens decides."
    expect(toMarkdown(plan)).toContain("(chosen)\n\n  Main's own list of screens decides.")
  })

  it("draws a steps split as a flow, loops back when asked, and dashes a step that is not built yet", () => {
    const flow = readTree(
      {
        kind: "explain",
        question: "How does an agent hand work to the owner?",
        answer: {
          claim: "Show the plan, prove it, show the result",
          group: { axis: "steps", covers: "one round of work", loop: true },
          children: [
            { claim: "Show the plan first", evidence: [{ ref: "plan.md", source: "Proposal" }] },
            { claim: "Prove the change with Verify", evidence: [{ ref: "proof.md", source: "Observed" }] },
          ],
        },
      },
      { resolves: () => true },
    ).tree
    const html = toHtml(flow)
    expect(html).toContain(
      '<section class="flow loops"><i class="loop-over" style="left:110px"></i><i class="loop-back"></i>',
    )
    expect(html.match(/<i class="arrow"><\/i>/g)).toHaveLength(1)
    expect(html).not.toContain('class="tree"')
    expect(html).toContain('<div class="box d1 unbuilt step">')
    expect(html).toContain("Dashed: not built yet")
    expect(html).toContain('<p class="kicker">How does an agent hand work to the owner?</p>')
  })

  it("dashes a sub-point inside a flow step when it is not built yet, so the legend matches what is drawn", () => {
    const flow = readTree(
      {
        kind: "explain",
        question: "How does an agent hand work to the owner?",
        answer: {
          claim: "Show the plan, then prove it",
          group: { axis: "steps", covers: "one round of work" },
          children: [
            { claim: "Show the plan first", evidence: [{ ref: "plan.md", source: "Observed" }] },
            {
              claim: "Prove the change with Verify",
              group: { axis: "parts", covers: "right and good to use" },
              children: [
                { claim: "Check it is right", evidence: [{ ref: "a.md", source: "Observed" }] },
                { claim: "Check it looks right", evidence: [{ ref: "b.png", source: "Proposal" }] },
              ],
            },
          ],
        },
      },
      { resolves: () => true },
    ).tree
    const html = toHtml(flow)
    expect(toHtml(flow, "", { "b.png": "data:image/png;base64,AA==" })).toContain(
      '<li class="unbuilt"><b>B2</b>Check it looks right<img class="thumb" src="data:image/png;base64,AA==" alt=""></li>',
    )
    const withPhoto = toHtml(flow, "", { "b.png": "data:image/png;base64,AA==" })
    expect(withPhoto).toContain('<div class="box d1 step with-photo"><span class="badge">B</span>')
    expect(withPhoto).toContain('<div class="box d1 step"><span class="badge">A</span>')
    expect(withPhoto).not.toContain("max-height")
    expect(html).toContain("Dashed: not built yet")
  })

  it("shortens a reference to what a reader recognises", () => {
    expect(shortRef(".agents/skills/verify-airdesign/look/before-after.mjs:180")).toBe("before-after.mjs:180")
    expect(shortRef("https://github.com/o/r/releases/download/proof-4/a%20b.png")).toBe("a b.png")
    expect(
      shortRef("https://github.com/o/r/releases/download/proof-4/branch-capture-outcomes-proof-2652c25e03.png"),
    ).toBe("…-proof-2652c25e03.png")
    expect(shortRef("https://github.com/Rickvu309/AirDesign/pull/1200")).toBe("PR 1200")
    expect(shortRef("look/a-very-long-file-name-for-a-test.mjs:180")).toBe("…me-for-a-test.mjs:180")
  })
})

it("starts the loop's return arrow over the middle of the first step, wide or not", () => {
  const flow = (ref) =>
    readTree(
      {
        kind: "explain",
        question: "How does a round of work go?",
        answer: {
          claim: "Show the plan, then prove it",
          group: { axis: "steps", covers: "one round of work", loop: true },
          children: [
            { claim: "Show the plan first", evidence: [{ ref, source: "Observed" }] },
            { claim: "Prove the change with Verify", evidence: [{ ref: "proof.md", source: "Observed" }] },
          ],
        },
      },
      { resolves: () => true },
    ).tree
  expect(toHtml(flow("plan.md"))).toContain('<i class="loop-over" style="left:110px"></i>')
  expect(toHtml(flow("https://example.test/plan.png"))).toContain('<i class="loop-over" style="left:165px"></i>')
})
