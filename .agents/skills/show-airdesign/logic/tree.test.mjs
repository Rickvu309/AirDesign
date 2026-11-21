import { describe, expect, it } from "vitest"
import { readTree } from "./tree.mjs"

const resolves = (ref) => !ref.includes("missing")

const leaf = (claim, evidence = [{ ref: "look/before-after.mjs:180", source: "Observed", verdict: "passed" }]) => ({
  claim,
  evidence,
})

const result = (overrides = {}) => ({
  kind: "assure",
  question: "Does before-after tell a failed base from a new state?",
  answer: {
    claim: "Before-after no longer calls a broken base new",
    group: { axis: "reasons", covers: "the old fault, the new rule, the proof" },
    children: [
      leaf("Any failure on main was labeled new"),
      leaf("Each capture now has one outcome"),
      leaf("Three real runs show only the new state says new"),
    ],
  },
  ...overrides,
})

const rules = (input) => readTree(input, { resolves }).refusals.map((refusal) => refusal.rule)

describe("a logic tree", () => {
  it("accepts a grounded result and rolls every verdict up to the answer", () => {
    const { tree, refusals } = readTree(result(), { resolves })
    expect(refusals).toEqual([])
    expect(tree.verdict).toBe("passed")
    expect(tree.children.map((child) => child.label)).toEqual(["A", "B", "C"])
  })

  it("lets one open leaf hold the whole answer open", () => {
    const input = result()
    input.answer.children[2] = leaf("Three real runs show only the new state says new", [
      { ref: "proof.md", source: "Observed", verdict: "open" },
    ])
    expect(readTree(input, { resolves }).tree.verdict).toBe("open")
  })

  it("lets a failed leaf beat an open one", () => {
    const input = result()
    input.answer.children[0].evidence[0].verdict = "failed"
    input.answer.children[1].evidence[0].verdict = "open"
    expect(readTree(input, { resolves }).tree.verdict).toBe("failed")
  })

  it("labels a deeper level by its branch, then by number, then by letter", () => {
    const input = result()
    input.answer.children[0] = {
      claim: "Any failure on main was labeled new",
      group: { axis: "reasons", covers: "both ways a base fails" },
      children: [
        {
          claim: "A journey that throws set the badge",
          group: { axis: "parts", covers: "drive and measure" },
          children: [leaf("The drive threw on a renamed step"), leaf("The measure threw on a timeout")],
        },
        leaf("A missing registry was read as new"),
      ],
    }
    const { tree, refusals } = readTree(input, { resolves })
    expect(refusals).toEqual([])
    expect(tree.children[0].children[0].children.map((child) => child.label)).toEqual(["A1a", "A1b"])
  })
})

describe("the rules a tree must keep", () => {
  it("one question: needs a kind, a question and an answer", () => {
    expect(rules({ kind: "guess", question: "", answer: null })).toEqual(["one-question"])
  })

  it("sentence: a claim is a sentence, not a topic", () => {
    const input = result()
    input.answer.children[1].claim = "Outcomes"
    expect(rules(input)).toEqual(["sentence"])
  })

  it("shape: a branch has two to four children", () => {
    const input = result()
    input.answer.children = [input.answer.children[0]]
    expect(rules(input)).toEqual(["shape"])
  })

  it("shape: a node is a branch or a leaf, never both", () => {
    const input = result()
    input.answer.evidence = [{ ref: "proof.md", source: "Observed", verdict: "passed" }]
    expect(rules(input)).toEqual(["shape"])
  })

  it("shape: a tree is at most three levels below the answer", () => {
    const input = result()
    const deep = (depth) =>
      depth === 0
        ? leaf("This leaf sits too deep")
        : {
            claim: `This branch sits at depth ${String(depth)}`,
            group: { axis: "reasons", covers: "both halves" },
            children: [deep(depth - 1), leaf("This leaf is a sibling")],
          }
    input.answer.children[0] = deep(3)
    expect(rules(input)).toEqual(["shape"])
  })

  it("vertical: the first split must answer the kind of question", () => {
    expect(rules(result({ kind: "decide" }))).toEqual(["vertical"])
    expect(rules(result({ kind: "explain" }))).toEqual(["vertical"])
  })

  it("horizontal: every split names its axis and what it covers", () => {
    const input = result()
    input.answer.group = { axis: "things", covers: "" }
    expect(rules(input)).toEqual(["horizontal", "horizontal"])
  })

  it("horizontal: only a steps split may loop back to its first step", () => {
    const input = result()
    input.answer.group.loop = true
    expect(rules(input)).toEqual(["horizontal"])
    const flow = result({ kind: "explain" })
    flow.answer.group = { axis: "steps", covers: "one round of review", loop: true }
    expect(rules(flow)).toEqual([])
  })

  it("grounded: every leaf has evidence and every reference opens", () => {
    const input = result()
    input.answer.children[0].evidence = []
    input.answer.children[1].evidence[0].ref = "missing.md:4"
    expect(rules(input)).toEqual(["grounded", "grounded"])
  })

  it("source: a proposal cannot pass, and a result cannot rest on a proposal or on no verdict", () => {
    const input = result()
    input.answer.children[0].evidence[0].source = "Proposal"
    delete input.answer.children[1].evidence[0].verdict
    expect(rules(input)).toEqual(["source", "source"])
  })

  it("source: a plan may rest on proposals with no verdict", () => {
    const plan = {
      kind: "decide",
      question: "How should before-after label a base it could not capture?",
      answer: {
        claim: "Label it Failed on main and keep New for missing states",
        group: { axis: "options", covers: "every label a failed base could get" },
        children: [
          leaf("Keep calling every failure new", [{ ref: "look/fragment.mjs:24", source: "Observed" }]),
          leaf("Split failed from new by the state list", [{ ref: "plan.md", source: "Proposal" }]),
        ],
      },
    }
    expect(readTree(plan, { resolves })).toMatchObject({ refusals: [], tree: { verdict: null } })
  })

  it("plain: a claim is short and has no code in it", () => {
    const input = result()
    input.answer.children[0].claim = "The fresh flag in before-after.mjs set the badge on every error"
    input.answer.children[1].claim = "readCallouts and captureSide now agree"
    input.answer.children[2].claim =
      "Three real runs against a planted base show that only the state main lacks is ever called new by the tool"
    expect(rules(input)).toEqual(["plain", "plain", "plain"])
  })

  it("plain: the question and what a split covers stay short and plain too", () => {
    const input = result({ question: "Does `composeBlock` badge a failed base?" })
    input.answer.group.covers = "the old fault, the new rule, the proof, and every edge case we found along the way"
    expect(rules(input)).toEqual(["plain", "plain"])
  })

  it("weakest support: a verdict lives on evidence, never on a claim", () => {
    const input = result()
    input.answer.verdict = "passed"
    expect(rules(input)).toEqual(["weakest"])
  })
})
