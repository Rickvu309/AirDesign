import { expect, it } from "vitest"
import { currentValue, decide, elementId, openRegister, replay, version } from "./index.js"

it("orders notes edits, replays offline notes, and undoes an agent edit", () => {
  const node = elementId("256.notes")
  let register = openRegister("", "")
  for (const command of [
    { command: "add", node, floor: "Imported notes", route: "notes.body" },
    { command: "start", node, runId: "notes-run" },
    { command: "agent", node, runId: "notes-run", readAt: 0, value: "Agent notes" },
    { command: "stop", node, runId: "notes-run" },
    { command: "undo", node, runId: "notes-run" },
  ] as const) {
    const next = decide(register, command)
    expect(next.decision).toBe("apply")
    if (next.decision === "apply") register = next.register
  }
  expect(currentValue(register.elements[node]!)).toBe("Imported notes")
  register = replay(register, [{ node, base: version(register.elements[node]!), value: "Offline notes" }])
  expect(currentValue(register.elements[node]!)).toBe("Offline notes")
})
