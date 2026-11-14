import { decide, elementId, format, openRegister, type Command, type Register } from "@airdesign/document"
import { expect, it } from "vitest"
import { designRows } from "./design-rows"

const node = elementId("256.2")

function landed(commands: readonly Command[]): Register {
  return commands.reduce(
    (register, command) => {
      const decision = decide(register, command)
      if (decision.decision === "refuse") throw new Error(decision.code)
      return decision.register
    },
    openRegister("", "deck"),
  )
}

const added: Command = { command: "add", node, floor: "", route: "deck" }
const box = { x: { set: 1 }, y: { set: 2 }, w: { set: 3 }, h: { set: 4 } }

it("paints a turn, a flip and a preset from the export, and leaves a move to the live box", () => {
  const moved = landed([added, { command: "person", node, v: format, patch: { box } }])
  expect(designRows(moved)).toEqual([])
  const turned = landed([
    added,
    { command: "person", node, v: format, patch: { box: { ...box, rot: { set: 60_000 }, flipH: { set: true } } } },
    { command: "person", node, v: format, patch: { geometry: { shape: { set: { preset: "ellipse", adjust: {} } } } } },
  ])
  expect(designRows(turned)).toEqual([
    [
      node,
      {
        box: { rot: { set: 60_000 }, flipH: { set: true } },
        geometry: { shape: { set: { preset: "ellipse", adjust: {} } } },
      },
    ],
  ])
})
