import {
  decide,
  elementId,
  format,
  landedPatch,
  openRegister,
  redoOf,
  rootElement,
  undoOf,
  type Command,
  type ElementPatch,
  type NodeRegister,
  type NodeStep,
  type Phase,
  type Register,
  type Undoable,
} from "@airdesign/document"

type Spec = Record<string, boolean | number | string>
type Graph = { states: Map<string, Spec>; edges: { from: string; to: string; action: string }[] }
type Landed = NodeRegister["landed"][number]

const run = "r"
const crops = {
  mine: { l: 10_000, t: 0, r: 10_000, b: 0 },
  aira: { l: 0, t: 20_000, r: 0, b: 20_000 },
} as const
const nodeA = rootElement
const nodeB = elementId("257.2")
const cropped: ElementPatch = { fills: { crop: { set: crops.mine } } }
const uncropped: ElementPatch = { fills: { crop: "opening" } }
const stepOf = (node: typeof nodeA): NodeStep => ({ node, before: uncropped, after: cropped })
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

export type OtherField = "recolor" | "overlay"

const shade = { solid: { rgb: "000000", transforms: [{ op: "alpha" as const, val: 50_000 }] } }

function agentPatch(field: string, other: OtherField): ElementPatch {
  if (field === "box" && other === "overlay") return { fills: { p3: { set: shade } } }
  if (field === "box") return { fills: { recolor: { set: { grayscale: true } } } }
  return { fills: { crop: { set: crops.aira } } }
}

function personRows(people: number, agent: Landed | null, agentAt: number): Landed[] {
  const landed: Landed[] = []
  for (let index = 0; index <= people; index += 1) {
    if (agent !== null && agentAt === index) landed.push(agent)
    if (index < people)
      landed.push({ actor: "person", v: format, patch: index % 2 === 0 ? cropped : uncropped, visible: true })
  }
  return landed
}

function agentRowOf(spec: Spec, other: OtherField): Landed | null {
  const agentRow = word(spec, "agentRow")
  if (agentRow === "none") return null
  const patch = agentPatch(word(spec, "agentField"), other)
  return { actor: "agent", v: format, patch, visible: agentRow === "shown", runId: run }
}

function registerOf(spec: Spec, other: OtherField): Register {
  const opened = openRegister("", "slide")
  const body = opened.elements[rootElement]
  if (body === undefined) throw new Error("missing node")
  const phase = phaseOf(spec)
  const readAt = num(spec, "readAt")
  const agent = agentRowOf(spec, other)
  const a: NodeRegister = {
    ...body,
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

function cropShown(body: NodeRegister): string {
  const crop = landedPatch(body, "text").fills?.crop
  if (crop === undefined || crop === "opening") return "file"
  if (typeof crop !== "object") return "other"
  if (JSON.stringify(crop.set) === JSON.stringify(crops.mine)) return "mine"
  return JSON.stringify(crop.set) === JSON.stringify(crops.aira) ? "aira" : "other"
}

function otherShown(body: NodeRegister): string {
  const fills = landedPatch(body, "text").fills
  const recolor = fills?.recolor
  const overlay = fills?.p3
  if (typeof recolor === "object" && "grayscale" in recolor.set) return "aira"
  return typeof overlay === "object" && "solid" in overlay.set ? "aira" : "file"
}

function picture(register: Register) {
  const a = bodyOf(register, nodeA)
  const b = bodyOf(register, nodeB)
  const agentAt = a.landed.findIndex((row) => row.actor === "agent")
  const agent = a.landed[agentAt]
  const others =
    agent !== undefined && "patch" in agent && (agent.patch.fills?.recolor ?? agent.patch.fills?.p3) !== undefined
  return {
    shownA: cropShown(a),
    shownB: cropShown(b),
    boxA: otherShown(a),
    rowsA: a.landed.filter((row) => row.actor === "person").length,
    rowsB: b.landed.filter((row) => row.actor === "person").length,
    agentRow: agent === undefined ? "none" : agent.visible ? "shown" : "hidden",
    agentField: agent === undefined ? "none" : others ? "box" : "text",
    agentAt,
    phase: a.phase,
    guarded: a.guarded,
  }
}

function expected(spec: Spec) {
  const shown = (rows: number) => (rows % 2 === 1 ? "mine" : "file")
  const onTop =
    word(spec, "agentRow") === "shown" &&
    word(spec, "agentField") === "text" &&
    num(spec, "agentAt") === num(spec, "rowsA")
  return {
    shownA: onTop ? "aira" : shown(num(spec, "rowsA")),
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

function commandsOf(
  action: string,
  source: Spec,
  register: Register,
  other: OtherField,
): readonly Command[] | "told" | null {
  const readAt = num(source, "readAt")
  if (action === "PersonEdit")
    return [nodeA, nodeB].map((node) => ({ command: "person", v: format, patch: cropped, node }) as const)
  if (action === "AgentStart") return [{ command: "start", runId: run, node: nodeA }]
  if (action === "AgentWrite" || action === "AgentMove") {
    const patch = agentPatch(action === "AgentMove" ? "box" : "text", other)
    return [{ command: "agent", runId: run, readAt, v: format, patch, node: nodeA }]
  }
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

export function replayPhotoUndo(
  graph: Graph,
  where: (source: Spec, target: Spec, action: string) => string,
  failures: string[],
  other: OtherField = "recolor",
) {
  let replayed = 0
  let told = 0
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing person-undo state for ${edge.action}`)
    const said = `person-undo on photos, Aira's other field ${other}, ${where(source, target, edge.action)}`
    const register = registerOf(source, other)
    const commands = commandsOf(edge.action, source, register, other)
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
