import { decide, elementId, openRegister, type Command, type Register } from "@airdesign/document"
import { expect, it } from "vitest"
import { shownValue } from "./editing/live-repaint"

const node = elementId("256.2")
const box = { x: 1, y: 2, cx: 3, cy: 4 }

function landed(commands: readonly Command[]): Register {
  let register = openRegister("", "deck")
  for (const command of commands) {
    const decision = decide(register, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    register = decision.register
  }
  return register
}

it("shows the file text of an element that only moved and the typed text once one lands", () => {
  const added = { command: "add", node, floor: "", route: "deck" } as const
  const moved = { command: "person", node, property: "box", value: box } as const
  expect(shownValue(landed([added, moved]), node, "Hello")).toBe("Hello")
  expect(shownValue(landed([added, moved, { command: "person", node, value: "Typed" }]), node, "Hello")).toBe("Typed")
})
