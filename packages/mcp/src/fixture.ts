import { readDeckId } from "@airdesign/catalog"
import { decide, openRegister, version, type Command, type ElementId, type Register } from "@airdesign/document"
import type { Deck } from "@airdesign/engine"
import { elements, fixtureRun as runId, type EditableName } from "./score.js"

export type Seed = {
  readonly element: EditableName
  readonly before?: readonly string[]
  readonly agent?: readonly string[]
  readonly undone?: boolean
  readonly during?: readonly string[]
}

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function readAtOf(register: Register, node: ElementId): number {
  const body = register.elements[node]
  if (body === undefined) throw new Error(node)
  return version(body)
}

function seeded(register: Register, seed: Seed): Register {
  const node = elements[seed.element]
  let next = applied(register, { command: "add", node, floor: register.floor, route: register.route })
  for (const value of seed.before ?? []) next = applied(next, { command: "person", value, node })
  next = applied(next, { command: "start", runId, node })
  for (const value of seed.agent ?? []) {
    next = applied(next, { command: "agent", runId, readAt: readAtOf(next, node), value, node })
  }
  if (seed.undone === true) next = applied(next, { command: "undo", runId, node })
  for (const value of seed.during ?? []) next = applied(next, { command: "person", value, node })
  return next
}

export function fixture(id: string, seeds: readonly Seed[], shape: (register: Register) => Register = (r) => r): Deck {
  const parsed = readDeckId(id)
  if (!parsed.ok) throw new Error(parsed.refusal)
  let register = openRegister("", "slide")
  for (const seed of seeds) register = seeded(register, seed)
  return { id: parsed.deck, revision: 0, register: shape(register) }
}
