const fixture = "tests/browser/deck-test.ts"
const approvalNote = "a person approves this kept wait, and its count in oxlintrc.json"
const longestKeep = 92
const dayMs = 86_400_000

const deckWait =
  "Open and wait for a deck with the decks fixture from tests/browser/deck-test.ts: decks.open(file), decks.blank() or decks.ready(), and decksOn(page) in a helper or on a second page."
const eventWait =
  "A fixed wait races the app. Wait for what a person sees with a web-first assertion such as await expect(locator).toBeVisible(), for a request with page.waitForRequest, for the deck with decks.ready(), or move time with page.clock."
const messages = {
  settled: `Do not define a settled helper. ${deckWait}`,
  mark: `Read the deck's readiness only through tests/browser/deck-test.ts: decks.ready(), decks.readiness(), or readyMark in a test of the signal itself. ${deckWait}`,
  sleep: `Remove waitForTimeout. ${eventWait}`,
  timer: `Remove this timer in a Promise. ${eventWait} Inside page.evaluate, return to the test and wait there.`,
  timeout:
    "Remove this per-test timeout. The project timeout is the ceiling: make the test wait on events and finish inside it.",
  slow: "Remove test.slow(). The project timeout is the ceiling: make the test wait on events and finish inside it.",
  retries: "Tests never retry. Remove retries from this configure call.",
}

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const browserPath = (filename) => {
  const at = filename.lastIndexOf("/tests/browser/")
  return at === -1 ? null : filename.slice(at + 1)
}

const propertyName = (node) =>
  node?.type === "Identifier" ? node.name : node?.type === "Literal" ? String(node.value) : undefined

const calleeMember = (node) =>
  node?.type === "MemberExpression" && !node.computed ? propertyName(node.property) : undefined

const rootName = (node) => {
  let current = node
  while (current?.type === "MemberExpression" || current?.type === "CallExpression")
    current = current.type === "CallExpression" ? current.callee : current.object
  return current?.type === "Identifier" ? current.name : undefined
}

const testRoots = new Set(["test", "stackTest", "testInfo"])
const timers = new Set(["setTimeout", "setInterval"])
const functions = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"])

const insidePromise = (node) => {
  let current = node.parent
  while (current) {
    if (functions.has(current.type)) {
      const parent = current.parent
      return (
        parent?.type === "NewExpression" &&
        parent.callee?.type === "Identifier" &&
        parent.callee.name === "Promise" &&
        parent.arguments[0] === current
      )
    }
    current = current.parent
  }
  return false
}

const stringOf = (node) => {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0]?.value.cooked
  return undefined
}

const field = (object, name) =>
  object.properties.find((property) => property.type === "Property" && propertyName(property.key) === name)?.value

const dayOf = (text) => {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(text)) return undefined
  const time = Date.parse(`${text}T00:00:00Z`)
  return Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== text ? undefined : time
}

const keptProblem = (call, today) => {
  const kept = call.arguments[1]
  if (call.arguments.length !== 2 || kept?.type !== "ObjectExpression")
    return "A kept wait is keptWait(wait, { why, until, approval: keptWaitApproval })."
  const why = stringOf(field(kept, "why"))
  if (why === undefined || why.trim() === "") return "A kept wait says why no event can replace it, in why."
  const until = stringOf(field(kept, "until"))
  const day = dayOf(until)
  if (day === undefined) return "A kept wait ends on a date written YYYY-MM-DD, in until."
  if (day < today)
    return `This kept wait ended on ${until}. Replace it with an event wait, or a person approves a new date.`
  if (day > today + longestKeep * dayMs) return `A kept wait lasts at most ${longestKeep} days.`
  const approval = field(kept, "approval")
  if (!(approval?.type === "Identifier" && approval.name === "keptWaitApproval") && stringOf(approval) !== approvalNote)
    return "A kept wait carries approval: keptWaitApproval, because a person approves it."
  return undefined
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "In tests/browser, wait on the app: refuse a settled helper, a raw data-deck-ready read, waitForTimeout, a timer in a Promise, test.setTimeout, test.slow and retries, unless a dated keptWait counted in the options keeps it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          kept: { type: "object", additionalProperties: { type: "integer" } },
          today: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const file = browserPath(filenameOf(context))
    if (file === null || file === "tests/browser/kept-wait.ts") return {}
    const options = context.options?.[0] ?? {}
    const today = dayOf(options.today) ?? Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
    const allowed = options.kept?.[file] ?? 0
    const kept = []
    const keptCall = (node) =>
      node?.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "keptWait"
        ? node
        : undefined
    const unlessKept = (node, wait, message) => {
      const call = keptCall(wait)
      if (call === undefined) context.report({ node, message })
    }
    return {
      CallExpression(node) {
        const kind = calleeMember(node.callee)
        if (node.callee.type === "Identifier" && node.callee.name === "keptWait") {
          const problem = keptProblem(node, today)
          if (problem === undefined) kept.push(node)
          else context.report({ node, message: problem })
          return
        }
        if (kind === "waitForTimeout") {
          unlessKept(node, node.arguments[0], messages.sleep)
          return
        }
        if (node.callee.type === "Identifier" && timers.has(node.callee.name) && insidePromise(node)) {
          unlessKept(node, node.arguments[1], messages.timer)
          return
        }
        const root = rootName(node.callee)
        if (root === undefined || !testRoots.has(root)) return
        if (kind === "setTimeout") unlessKept(node, node.arguments[0], messages.timeout)
        else if (kind === "slow") context.report({ node, message: messages.slow })
        else if (kind === "configure") {
          const settings = node.arguments[0]
          if (settings?.type !== "ObjectExpression") return
          if (field(settings, "retries") !== undefined) context.report({ node, message: messages.retries })
          if (field(settings, "timeout") !== undefined) context.report({ node, message: messages.timeout })
        }
      },
      "FunctionDeclaration, VariableDeclarator"(node) {
        if (node.id?.type === "Identifier" && node.id.name === "settled")
          context.report({ node: node.id, message: messages.settled })
      },
      Literal(node) {
        if (file !== fixture && typeof node.value === "string" && node.value.includes("data-deck-ready"))
          context.report({ node, message: messages.mark })
      },
      TemplateElement(node) {
        if (file !== fixture && node.value.cooked?.includes("data-deck-ready"))
          context.report({ node, message: messages.mark })
      },
      "Program:exit"() {
        for (const node of kept.slice(allowed))
          context.report({
            node,
            message: `${file} may keep ${allowed} waits, set in the no-blind-wait options in tooling/oxlint-plugin-airdesign/oxlintrc.json. A new kept wait needs a person to raise that count; replace it with an event wait instead.`,
          })
      },
    }
  },
}

export default rule
