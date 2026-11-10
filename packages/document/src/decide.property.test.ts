import fc from "fast-check"
import { it } from "vitest"
import { decide, history, openRegister, version, type Command, type Decision, type Register } from "./decide.js"

function personValues(register: Register): readonly string[] {
  const values: string[] = []
  for (const row of register.landed) {
    if (row.visible && row.actor === "person") {
      values.push(row.value)
    }
  }
  return values
}

function visibleAgentCount(register: Register): number {
  let count = 0
  for (const row of register.landed) {
    if (row.visible && row.actor === "agent") {
      count += 1
    }
  }
  return count
}

function versionHolds(register: Register): boolean {
  return version(register) === personValues(register).length + visibleAgentCount(register)
}

function settled(before: Register, decision: Decision): Register {
  return decision.decision === "apply" ? decision.register : before
}

function holds(before: Register, command: Command, decision: Decision): boolean {
  if (command.command === "person" && decision.decision !== "apply") {
    return false
  }
  const after = settled(before, decision)
  if (!versionHolds(after)) {
    return false
  }
  if (command.command === "agent" && decision.decision === "apply" && decision.register.claimed !== version(before)) {
    return false
  }
  if (before.guarded && command.command === "agent" && decision.decision !== "refuse") {
    return false
  }
  if (before.phase === "stopped" && command.command === "agent" && decision.decision !== "refuse") {
    return false
  }
  if (command.command === "undo" && decision.decision === "apply") {
    const people = personValues(before)
    const seen = history(after)
    if (visibleAgentCount(after) !== 0) {
      return false
    }
    if (seen.length !== people.length) {
      return false
    }
    for (let index = 0; index < people.length; index += 1) {
      if (seen[index] !== people[index]) {
        return false
      }
    }
  }
  return true
}

const runId = fc.constantFrom("r", "s")
const value = fc.string({ minLength: 0, maxLength: 8 })

const command: fc.Arbitrary<Command> = fc.oneof(
  value.map((next) => ({ command: "person" as const, value: next })),
  fc.record({
    command: fc.constant("agent" as const),
    runId,
    readAt: fc.integer({ min: 0, max: 8 }),
    value,
  }),
  runId.map((next) => ({ command: "start" as const, runId: next })),
  runId.map((next) => ({ command: "stop" as const, runId: next })),
  runId.map((next) => ({ command: "undo" as const, runId: next })),
)

it("keeps the register rules on every prefix of a command sequence", () => {
  fc.assert(
    fc.property(fc.array(command, { minLength: 0, maxLength: 12 }), (commands) => {
      let register = openRegister("floor", "slide")
      if (!versionHolds(register)) {
        return false
      }
      for (const next of commands) {
        const decision = decide(register, next)
        if (!holds(register, next, decision)) {
          return false
        }
        register = settled(register, decision)
      }
      return true
    }),
  )
})
