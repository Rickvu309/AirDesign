import {
  currentBox,
  currentValue,
  decide,
  elementId,
  openRegister,
  redoOf,
  rootElement,
  undoOf,
  type Box,
  type Command,
  type NodeRegister,
  type NodeStep,
  type Phase,
  type Register,
  type Undoable,
} from "@airdesign/document"

type Spec = Record<string, boolean | number | string>
type Graph = { states: Map<string, Spec>; edges: { from: string; to: string; action: string }[] }
type Row = NodeRegister["landed"][number]

const run = "r"
const texts = { file: "Old", mine: "New", aira: "Aira" } as const
const boxes = { file: { x: 0, y: 0, cx: 100, cy: 100 }, aira: { x: 50, y: 50, cx: 100, cy: 100 } } as const
const nodeA = rootElement
const nodeB = elementId("257.2")
const text = (value: string) => ({ text: { value: { set: value } } })
const stepOf = (node: typeof nodeA): NodeStep => ({ node, before: text(texts.file), after: text(texts.mine) })
const steps: Undoable = { steps: [stepOf(nodeB), stepOf(nodeA)] }
const alone: Undoable = { steps: [stepOf(nodeA)] }

function num(spec: Spec, key: string): number {
  const value = spec[key]
  if (typeof value !== "number") throw new Error(`${key} is not a number`)
  return value
}

function word(spec: Spec, key: string): string {
  const value = spec[key]
  if (typeof value !== "string") throw new Error(`${key} is not text`)
  return value
}

function flag(spec: Spec, key: string): boolean {
  const value = spec[key]
  if (typeof value !== "boolean") throw new Error(`${key} is not a boolean`)
  return value
}

function phaseOf(spec: Spec): Phase {
  const phase = word(spec, "phase")
  if (phase === "idle" || phase === "running" || phase === "stopped" || phase === "undone") return phase
  throw new Error(`bad phase ${phase}`)
}

function personRows(people: number, agent: Row | null, agentAt: number): Row[] {
  const landed: Row[] = []
  for (let index = 0; index <= people; index += 1) {
    if (agent !== null && agentAt === index) landed.push(agent)
    if (index < people)
      landed.push({ actor: "person", value: index % 2 === 0 ? texts.mine : texts.file, visible: true })
  }
  return landed
}

function agentRowOf(spec: Spec): Row | null {
  const agentRow = word(spec, "agentRow")
  if (agentRow === "none") return null
  const visible = agentRow === "shown"
  if (word(spec, "agentField") === "box")
    return { actor: "agent", property: "box", value: boxes.aira, visible, runId: run }
  return { actor: "agent", value: texts.aira, visible, runId: run }
}

function registerOf(spec: Spec): Register {
  const opened = openRegister(texts.file, "slide")
  const body = opened.elements[rootElement]
  if (body === undefined) throw new Error("missing node")
  const phase = phaseOf(spec)
  const readAt = num(spec, "readAt")
  const agent = agentRowOf(spec)
  const a: NodeRegister = {
    ...body,
    floorBox: boxes.file,
    landed: personRows(num(spec, "rowsA"), agent, num(spec, "agentAt")),
    phase,
    runId: phase === "idle" ? null : run,
    readAt: readAt === -1 ? null : readAt,
    guarded: flag(spec, "guarded"),
    claimed: agent === null || readAt === -1 ? null : readAt,
  }
  const b: NodeRegister = { ...body, landed: personRows(num(spec, "rowsB"), null, -1) }
  return { ...opened, nodes: [nodeA, nodeB], elements: { [nodeA]: a, [nodeB]: b } }
}

function bodyOf(register: Register, node: typeof nodeA): NodeRegister {
  const body = register.elements[node]
  if (body === undefined) throw new Error("missing node")
  return body
}

function boxName(box: Box | null): string {
  if (JSON.stringify(box) === JSON.stringify(boxes.aira)) return "aira"
  return JSON.stringify(box) === JSON.stringify(boxes.file) ? "file" : "other"
}

function picture(register: Register) {
  const a = bodyOf(register, nodeA)
  const b = bodyOf(register, nodeB)
  const agentAt = a.landed.findIndex((row) => row.actor === "agent")
  const agent = a.landed[agentAt]
  return {
    shownA: currentValue(a),
    shownB: currentValue(b),
    boxA: boxName(currentBox(a)),
    rowsA: a.landed.filter((row) => row.actor === "person").length,
    rowsB: b.landed.filter((row) => row.actor === "person").length,
    agentRow: agent === undefined ? "none" : agent.visible ? "shown" : "hidden",
    agentField: agent === undefined ? "none" : agent.property === "box" ? "box" : "text",
    agentAt,
    phase: a.phase,
    guarded: a.guarded,
  }
}

function expected(spec: Spec) {
  const shown = (rows: number) => (rows % 2 === 1 ? texts.mine : texts.file)
  const onTop =
    word(spec, "agentRow") === "shown" &&
    word(spec, "agentField") === "text" &&
    num(spec, "agentAt") === num(spec, "rowsA")
  return {
    shownA: onTop ? texts.aira : shown(num(spec, "rowsA")),
    shownB: shown(num(spec, "rowsB")),
    boxA: word(spec, "boxA"),
    rowsA: num(spec, "rowsA"),
    rowsB: num(spec, "rowsB"),
    agentRow: word(spec, "agentRow"),
    agentField: word(spec, "agentField"),
    agentAt: num(spec, "agentAt"),
    phase: word(spec, "phase"),
    guarded: flag(spec, "guarded"),
  }
}

function turnOf(action: "Undo" | "Redo", register: Register): readonly Command[] | "told" {
  const turn = action === "Undo" ? undoOf(register, steps) : redoOf(register, steps)
  return turn.ok ? turn.commands : "told"
}

function aloneAgrees(action: string, register: Register, commands: readonly Command[] | "told"): boolean {
  if (action !== "Undo" && action !== "Redo") return true
  const single = action === "Undo" ? undoOf(register, alone) : redoOf(register, alone)
  return single.ok === (commands !== "told")
}

function commandsOf(action: string, source: Spec, register: Register): readonly Command[] | "told" | null {
  const readAt = num(source, "readAt")
  if (action === "PersonEdit")
    return [nodeA, nodeB].map((node) => ({ command: "person", value: texts.mine, node }) as const)
  if (action === "AgentStart") return [{ command: "start", runId: run, node: nodeA }]
  if (action === "AgentWrite") return [{ command: "agent", runId: run, readAt, value: texts.aira, node: nodeA }]
  if (action === "AgentMove")
    return [{ command: "agent", runId: run, readAt, property: "box", value: boxes.aira, node: nodeA }]
  if (action === "AgentStop") return [{ command: "stop", runId: run, node: nodeA }]
  if (action === "AgentUndo") return [{ command: "undo", runId: run, node: nodeA }]
  if (action === "Undo" || action === "Redo") return turnOf(action, register)
  return null
}

function landed(register: Register, commands: readonly Command[]): Register | string {
  let current = register
  for (const command of commands) {
    const decision = decide(current, command)
    if (decision.decision !== "apply") return decision.code
    current = decision.register
  }
  return current
}

export function replayPersonUndo(
  graph: Graph,
  where: (source: Spec, target: Spec, action: string) => string,
  failures: string[],
) {
  let replayed = 0
  let told = 0
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing person-undo state for ${edge.action}`)
    const said = `person-undo ${where(source, target, edge.action)}`
    const register = registerOf(source)
    const commands = commandsOf(edge.action, source, register)
    if (commands === null) {
      failures.push(`${said} is not connected`)
      continue
    }
    if (!aloneAgrees(edge.action, register, commands)) failures.push(`${said}: undo of A alone disagrees with the step`)
    const refused = word(target, "held") === "dropped" && word(source, "held") !== "dropped"
    if (commands === "told") {
      if (!refused) failures.push(`${said} was refused`)
      else told += 1
      continue
    }
    if (refused) {
      failures.push(`${said} landed`)
      continue
    }
    const after = landed(register, commands)
    if (typeof after === "string") {
      failures.push(`${said} refused ${after}`)
      continue
    }
    const actual = picture(after)
    if (JSON.stringify(actual) !== JSON.stringify(expected(target))) {
      failures.push(`${said}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected(target))}`)
      continue
    }
    replayed += 1
  }
  return { replayed, told }
}
