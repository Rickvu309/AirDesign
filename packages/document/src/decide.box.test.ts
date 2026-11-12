import fc from "fast-check"
import { expect, it } from "vitest"
import type { Box } from "./box.js"
import {
  currentBox,
  currentValue,
  decide,
  history,
  openRegister,
  version,
  type Command,
  type NodeRegister,
  type Register,
} from "./decide.js"
import { elementId } from "./element-id.js"

const node = elementId("258.7")
const first: Box = { x: 10, y: 20, cx: 300, cy: 400 }
const second: Box = { x: -10, y: 0, cx: 0, cy: 1 }

function opened(): Register {
  const added = decide(openRegister("", "deck"), { command: "add", node, floor: "file text", route: "deck" })
  if (added.decision !== "apply") throw new Error(added.code)
  return added.register
}

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(`${command.command} refused ${decision.code}`)
  return decision.register
}

function bodyOf(register: Register): NodeRegister {
  const body = register.elements[node]
  if (body === undefined) throw new Error("missing node")
  return body
}

it("lands a person box as its own row and leaves the text where it was", () => {
  let register = opened()
  expect(currentBox(bodyOf(register))).toBeNull()
  register = applied(register, { command: "person", node, value: "typed" })
  register = applied(register, { command: "person", node, property: "box", value: first })
  const body = bodyOf(register)
  expect(body.landed).toEqual([
    { actor: "person", value: "typed", visible: true },
    { actor: "person", property: "box", value: first, visible: true },
  ])
  expect(version(body)).toBe(2)
  expect(currentBox(body)).toEqual(first)
  expect(currentValue(body)).toBe("typed")
  expect(history(body)).toEqual(["typed"])
})

it("keeps the file text for an element that only moved", () => {
  const body = bodyOf(applied(opened(), { command: "person", node, property: "box", value: first }))
  expect(currentValue(body)).toBe("file text")
  expect(history(body)).toEqual([])
})

it("undo takes back the run's box and keeps the person's box", () => {
  let register = applied(opened(), { command: "person", node, property: "box", value: first })
  register = applied(register, { command: "start", node, runId: "run" })
  register = applied(register, { command: "agent", node, runId: "run", readAt: 1, property: "box", value: second })
  expect(currentBox(bodyOf(register))).toEqual(second)
  register = applied(register, { command: "undo", node, runId: "run" })
  expect(currentBox(bodyOf(register))).toEqual(first)
  expect(version(bodyOf(register))).toBe(3)
})

const steps = ["person", "start", "stop", "undo", "fresh", "stale", "claimed", "read"] as const

type Step = (typeof steps)[number]

function commandOf(step: Step, register: Register, value: (index: number) => Command, index: number): Command {
  const body = bodyOf(register)
  const edit = value(index)
  switch (step) {
    case "person":
      return edit
    case "start":
    case "stop":
    case "undo":
    case "read":
      return { command: step, node, runId: "run" }
    case "fresh":
    case "stale":
    case "claimed": {
      const readAt = step === "fresh" ? version(body) : step === "stale" ? version(body) + 7 : (body.claimed ?? 0)
      if (edit.command !== "person") throw new Error("edit")
      return { ...edit, command: "agent", runId: "run", readAt }
    }
  }
}

function runState(register: Register): string {
  const { phase, runId, readAt, guarded, claimed, stoppedAt } = bodyOf(register)
  return JSON.stringify({ version: version(bodyOf(register)), phase, runId, readAt, guarded, claimed, stoppedAt })
}

function walk(order: readonly Step[], value: (index: number) => Command): readonly string[] {
  let register = opened()
  const seen: string[] = []
  for (const [index, step] of order.entries()) {
    const decision = decide(register, commandOf(step, register, value, index))
    if (decision.decision === "apply") register = decision.register
    seen.push(`${decision.decision === "apply" ? "apply" : decision.code} ${runState(register)}`)
  }
  return seen
}

it("decides a box write by the same order, protection and stale rules as a text write", () => {
  fc.assert(
    fc.property(fc.array(fc.constantFrom(...steps), { maxLength: 12 }), (order) => {
      const texts = walk(order, (index) => ({ command: "person", node, value: `text ${index}` }))
      const boxes = walk(order, (index) => ({
        command: "person",
        node,
        property: "box",
        value: { x: index, y: index, cx: index, cy: index },
      }))
      return JSON.stringify(texts) === JSON.stringify(boxes)
    }),
  )
})
