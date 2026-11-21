import { currentValue, decide, elementId, openRegister, type Register } from "@airdesign/document"
import { expect, it } from "vitest"
import { paintingAhead, personCommands } from "./painted-ahead"

const node = elementId("256.2")
const typed = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Typed" }] }])
const device = openRegister("", "deck")

function text(register: Register | null): string | null {
  const body = register?.elements[node]
  return body === undefined ? null : currentValue(body)
}

function canvas() {
  const seen: { register: Register | null; painted: number } = { register: device, painted: 0 }
  const ahead = paintingAhead({
    shown: () => seen.register,
    keep: (register) => {
      seen.register = register
    },
    show: (register) => {
      seen.register = ahead.on(register)
      seen.painted += 1
    },
  })
  return { seen, ahead }
}

it("keeps typed words ahead of the device through a repaint of an older deck, until the device wrote them", () => {
  const { seen, ahead } = canvas()
  const written = ahead.hold(personCommands(device, node, "", { value: typed }))
  expect(text(seen.register)).toBe(typed)
  expect(seen.painted).toBe(0)
  expect(text(ahead.on(device))).toBe(typed)
  written()
  expect(text(ahead.on(device))).toBeNull()
})

it("paints a change ahead at once and applies it once over a deck that already holds it", () => {
  const { seen, ahead } = canvas()
  const commands = personCommands(device, node, "", { value: typed })
  ahead.paint(commands)
  expect(seen.painted).toBe(1)
  expect(text(seen.register)).toBe(typed)
  const stored = commands.reduce((register, command) => {
    const decision = decide(register, command)
    return decision.decision === "apply" ? decision.register : register
  }, device)
  expect(text(ahead.on(stored))).toBe(typed)
  expect(ahead.on(stored).nodes.filter((each) => each === node)).toHaveLength(1)
})

it("tells once every edit painted ahead so far was written, not one painted after", async () => {
  const { ahead } = canvas()
  const steps: string[] = []
  const first = ahead.hold(personCommands(device, node, "", { value: typed }))
  const second = ahead.paint(personCommands(device, node, "", { value: typed }))
  const told = ahead.stored().then(() => steps.push("told"))
  const later = ahead.hold(personCommands(device, node, "", { value: typed }))
  second()
  await Promise.resolve()
  expect(steps).toEqual([])
  first()
  await told
  expect(steps).toEqual(["told"])
  expect(ahead.holding()).toBe(true)
  later()
})
