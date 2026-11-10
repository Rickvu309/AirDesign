import { decide, elementId, openRegister } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { heldElements } from "./edit-answer.js"

describe("heldElements", () => {
  it("shows a removed element as absent, not its old value", () => {
    const node = elementId("258.7")
    let register = openRegister("", "slide")
    for (const command of [
      { command: "add", node, floor: "", route: "slide" },
      { command: "person", value: "old", node },
      { command: "remove", node },
    ] as const) {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    expect(register.elements[node]).toBeDefined()
    expect(heldElements(register, [node])).toEqual([{ node, value: "", version: 0 }])
  })

  it("marks an element a person edited during the running run as closed", () => {
    const node = elementId("258.7")
    let register = openRegister("", "slide")
    for (const command of [
      { command: "add", node, floor: "", route: "slide" },
      { command: "start", runId: "run", node },
      { command: "person", value: "person", node },
    ] as const) {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    expect(heldElements(register, [node])).toEqual([{ node, value: "person", version: 1, closed: true }])
  })
})
