import {
  currentValue,
  decide,
  openRegister,
  redoOf,
  rootElement,
  undoOf,
  type Command,
  type NodeRegister,
  type Phase,
  type Register,
  type Undoable,
} from "@airdesign/document"

type Spec = Record<string, boolean | number | string>
type Graph = { states: Map<string, Spec>; edges: { from: string; to: string; action: string }[] }

const run = "r"
const texts = { file: "Old", mine: "New", aira: "Aira" } as const
const undoable: Undoable = {
  node: rootElement,
  floor: texts.file,
  before: { value: texts.file },
  after: { value: texts.mine },
}

function num(spec: Spec, key: string): number {
  const value = spec[key]
  if (typeof value !== "number") throw new Error(`${key} is not a number`)
  return value
}

function text(spec: Spec, key: string): string {
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
  const phase = text(spec, "phase")
  if (phase === "idle" || phase === "running" || phase === "stopped" || phase === "undone") return phase
  throw new Error(`bad phase ${phase}`)
}

function registerOf(spec: Spec): Register {
  const agentRow = text(spec, "agentRow")
  const agentAt = num(spec, "agentAt")
  const people = num(spec, "personRows")
  const agent = { actor: "agent" as const, value: texts.aira, visible: agentRow === "shown", runId: run }
  const landed: NodeRegister["landed"][number][] = []
  for (let index = 0; index <= people; index += 1) {
    if (agentRow !== "none" && agentAt === index) landed.push(agent)
    if (index < people)
      landed.push({ actor: "person", value: index % 2 === 0 ? texts.mine : texts.file, visible: true })
  }
  const phase = phaseOf(spec)
  const readAt = num(spec, "readAt")
  const opened = openRegister(texts.file, "slide")
  const body = opened.elements[rootElement]
  if (body === undefined) throw new Error("missing node")
  const node: NodeRegister = {
    ...body,
    landed,
    phase,
    runId: phase === "idle" ? null : run,
    readAt: readAt === -1 ? null : readAt,
    guarded: flag(spec, "guarded"),
    claimed: agentRow === "none" || readAt === -1 ? null : readAt,
  }
  return { ...opened, elements: { [rootElement]: node } }
}

function picture(register: Register) {
  const body = register.elements[rootElement]
  if (body === undefined) throw new Error("missing node")
  const agentAt = body.landed.findIndex((row) => row.actor === "agent")
  const agent = body.landed[agentAt]
  return {
    shown: currentValue(body),
    personRows: body.landed.filter((row) => row.actor === "person").length,
    agentRow: agent === undefined ? "none" : agent.visible ? "shown" : "hidden",
    agentAt,
    phase: body.phase,
    guarded: body.guarded,
  }
}

function expected(spec: Spec) {
  const people = num(spec, "personRows")
  const onTop = text(spec, "agentRow") === "shown" && num(spec, "agentAt") === people
  const personShown = people % 2 === 1 ? texts.mine : texts.file
  return {
    shown: onTop ? texts.aira : personShown,
    personRows: people,
    agentRow: text(spec, "agentRow"),
    agentAt: num(spec, "agentAt"),
    phase: text(spec, "phase"),
    guarded: flag(spec, "guarded"),
  }
}

function commandOf(action: string, source: Spec, register: Register): Command | "told" | null {
  if (action === "PersonEdit") return { command: "person", value: texts.mine, node: rootElement }
  if (action === "AgentStart") return { command: "start", runId: run, node: rootElement }
  if (action === "AgentWrite") {
    return { command: "agent", runId: run, readAt: num(source, "readAt"), value: texts.aira, node: rootElement }
  }
  if (action === "AgentStop") return { command: "stop", runId: run, node: rootElement }
  if (action === "AgentUndo") return { command: "undo", runId: run, node: rootElement }
  if (action === "Undo" || action === "Redo") {
    const turn = action === "Undo" ? undoOf(register, undoable) : redoOf(register, undoable)
    return turn.ok ? turn.command : "told"
  }
  return null
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
    const command = commandOf(edge.action, source, register)
    if (command === null) {
      failures.push(`${said} is not connected`)
      continue
    }
    const refused = text(target, "held") === "dropped" && text(source, "held") !== "dropped"
    if (command === "told") {
      if (!refused) failures.push(`${said} was refused`)
      else told += 1
      continue
    }
    if (refused) {
      failures.push(`${said} landed`)
      continue
    }
    const decision = decide(register, command)
    if (decision.decision !== "apply") {
      failures.push(`${said} refused ${decision.code}`)
      continue
    }
    const actual = picture(decision.register)
    if (JSON.stringify(actual) !== JSON.stringify(expected(target))) {
      failures.push(`${said}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected(target))}`)
      continue
    }
    replayed += 1
  }
  return { replayed, told }
}
