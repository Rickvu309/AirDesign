export const axesFor = { decide: ["options"], explain: ["steps", "parts"], assure: ["reasons"] }
export const sources = ["Proposal", "Prototype", "Observed"]

const axes = ["options", "steps", "parts", "reasons"]
const strength = { failed: 0, open: 1, passed: 2 }
const deepestBranch = 2
const wordsIn = (text) => String(text).trim().split(/\s+/).filter(Boolean).length
const codeWords = [
  /`/,
  /\b[\w.-]+\/[\w./-]+\b/,
  /\.(m?js|ts|tsx|json|md|tla|cfg)\b/,
  /\b[a-z]+[A-Z]\w*/,
  /\b\w+_\w+/,
  /\(\)|=>/,
]
const longest = { answer: 22, claim: 16, covers: 14, question: 16, detail: 28 }

export function unplain(text, limit) {
  if (typeof text !== "string") return null
  if (wordsIn(text) > limit) return `keep it to ${String(limit)} words; this has ${String(wordsIn(text))}`
  if (codeWords.some((pattern) => pattern.test(text)))
    return "write it the way you would say it to the owner, and leave code names to the evidence"
  return null
}

export function weakest(verdicts) {
  const present = verdicts.filter((verdict) => verdict !== null)
  if (present.length === 0) return null
  return present.reduce((weak, verdict) => (strength[verdict] < strength[weak] ? verdict : weak))
}

function labelOf(parent, index, depth) {
  if (depth === 1) return String.fromCharCode(65 + index)
  if (depth === 2) return `${parent}${String(index + 1)}`
  return `${parent}${String.fromCharCode(97 + index)}`
}

function readEvidence(evidence, at, { kind, resolves, refuse }) {
  if (evidence.length === 0)
    refuse("grounded", at, "a leaf rests on evidence: a file and line, a run artifact or a proof link")
  for (const piece of evidence) {
    if (typeof piece.ref !== "string" || !resolves(piece.ref))
      refuse("grounded", at, `${String(piece.ref)} does not open`)
    if (!sources.includes(piece.source)) {
      refuse("source", at, `label each piece of evidence ${sources.join(", ")}`)
      continue
    }
    if (piece.verdict !== undefined && !(piece.verdict in strength))
      refuse("weakest", at, `a verdict is passed, open or failed, not ${String(piece.verdict)}`)
    if (piece.source === "Proposal" && (piece.verdict === "passed" || kind === "assure"))
      refuse(
        "source",
        at,
        kind === "assure"
          ? "a result rests on what ran: Prototype or Observed"
          : "a proposal has not run, so it cannot pass",
      )
    else if (kind === "assure" && piece.verdict === undefined)
      refuse("source", at, "a result needs a verdict on every piece of evidence")
  }
  return weakest(evidence.map((piece) => (piece.verdict in strength ? piece.verdict : null)))
}

function readNode(node, place, context) {
  const { label, depth } = place
  const { kind, refuse } = context
  if (node === null || typeof node !== "object") {
    refuse("shape", label, "every node is an object with a claim")
    return { label, claim: "", verdict: null }
  }
  if ("verdict" in node)
    refuse("weakest", label, "a verdict lives on evidence; the tree rolls it up and a claim never states it")
  if (typeof node.claim !== "string" || wordsIn(node.claim) < 3)
    refuse("sentence", label, "write the claim as a sentence of at least three words, not a topic")
  const loud = unplain(node.claim, depth === 0 ? longest.answer : longest.claim)
  if (loud) refuse("plain", label, loud)
  if ("detail" in node) {
    const murky =
      typeof node.detail !== "string" ? "a detail is one or two plain sentences" : unplain(node.detail, longest.detail)
    if (murky) refuse("plain", label, `detail: ${murky}`)
  }
  const said = typeof node.detail === "string" ? { detail: node.detail } : {}
  const branch = Array.isArray(node.children)
  const leaf = Array.isArray(node.evidence)
  if (branch === leaf) {
    refuse(
      "shape",
      label,
      branch ? "a node holds children or evidence, never both" : "a node needs children or evidence",
    )
    return { label, claim: node.claim, verdict: null }
  }
  if (leaf)
    return {
      label,
      claim: node.claim,
      ...said,
      evidence: node.evidence,
      verdict: readEvidence(node.evidence, label, context),
    }
  const count = node.children.length
  if (count < 2 || count > 4)
    refuse("shape", label, `a branch holds two to four children; this one holds ${String(count)}`)
  if (depth > deepestBranch) refuse("shape", label, "a tree goes at most three levels below the answer")
  const group = node.group ?? {}
  if (!axes.includes(group.axis)) refuse("horizontal", label, `name the split's axis: one of ${axes.join(", ")}`)
  if (typeof group.covers !== "string" || group.covers.trim() === "")
    refuse("horizontal", label, "say what the split covers, so a reader can see whether a branch is missing")
  else if (unplain(group.covers, longest.covers))
    refuse("plain", label, `covers: ${unplain(group.covers, longest.covers)}`)
  if ("loop" in group && (group.axis !== "steps" || typeof group.loop !== "boolean"))
    refuse("horizontal", label, "only a steps split can loop, and loop is true or false")
  if (depth === 0 && axes.includes(group.axis) && !axesFor[kind].includes(group.axis))
    refuse("vertical", label, `a ${kind} question splits first by ${axesFor[kind].join(" or ")}, not ${group.axis}`)
  const children = node.children.map((child, index) =>
    readNode(child, { label: labelOf(label, index, depth + 1), depth: depth + 1 }, context),
  )
  return {
    label,
    claim: node.claim,
    ...said,
    group,
    children,
    verdict: weakest(children.map((child) => child.verdict)),
  }
}

export function readTree(input, { resolves }) {
  const refusals = []
  const refuse = (rule, at, message) => refusals.push({ rule, at, message })
  const asked = input !== null && typeof input === "object"
  if (
    !asked ||
    !(input.kind in axesFor) ||
    typeof input.question !== "string" ||
    input.question.trim() === "" ||
    input.answer === null ||
    typeof input.answer !== "object"
  ) {
    refuse("one-question", "answer", "a tree needs a kind (decide, explain or assure), one question and one answer")
    return { refusals, tree: null }
  }
  const hard = unplain(input.question, longest.question)
  if (hard) refuse("plain", "question", hard)
  const answer = readNode(input.answer, { label: "answer", depth: 0 }, { kind: input.kind, resolves, refuse })
  return { refusals, tree: refusals.length === 0 ? { kind: input.kind, question: input.question, ...answer } : null }
}
