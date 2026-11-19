import { version, type NodeRegister, type Register } from "@airdesign/document"
import { personSplit, storedRoot } from "./spec-register.js"
import { flag, num, phaseOf, text } from "./spec-values.js"

type Value = boolean | number | string
type Spec = Record<string, Value>

const run = "r"

function editVersion(spec: Spec): number {
  return num(spec, "personBefore") + num(spec, "personAfter") + num(spec, "agent") + 2 * num(spec, "hidden")
}

export function nodeRegister(spec: Spec): Register {
  const landed: NodeRegister["landed"][number][] = []
  for (let index = 0; index < num(spec, "personBefore"); index += 1) {
    landed.push({ actor: "person", value: "before", visible: true })
  }
  if (num(spec, "agent") === 1 || num(spec, "agentAt") !== -1) {
    landed.push({ actor: "agent", value: "agent", visible: num(spec, "agent") === 1 })
  }
  if (num(spec, "agent") === 2) {
    const at = landed.findIndex((row) => row.actor === "agent")
    const first = { actor: "agent" as const, value: "agent", visible: true }
    const second = { actor: "agent" as const, value: "again", visible: true }
    if (at >= 0) landed.splice(at, 1, first, second)
    else landed.push(first, second)
  }
  for (let index = 0; index < num(spec, "personAfter"); index += 1) {
    landed.push({ actor: "person", value: "later", visible: true })
  }
  for (const row of landed) {
    if (row.actor === "agent") Object.assign(row, { runId: run })
  }
  const phase = phaseOf(spec)
  return storedRoot({
    landed,
    version: editVersion(spec),
    phase,
    runId: phase === "idle" ? null : run,
    readAt: num(spec, "readAt") === -1 ? null : num(spec, "readAt"),
    guarded: flag(spec, "guarded"),
    claimed: num(spec, "claims") === -1 ? null : num(spec, "claims"),
    stoppedAt: num(spec, "stoppedAt") === -1 ? null : num(spec, "stoppedAt"),
  })
}

export function editPicture(register: Register, positional: boolean) {
  const split = personSplit(register)
  const person = split.personBefore + split.personAfter
  const picture: Record<string, Value> = {
    phase: register.phase,
    version: version(register),
    readAt: register.readAt === null ? -1 : register.readAt,
    guarded: register.guarded,
    agent: register.landed.filter((row) => row.visible && row.actor === "agent").length,
    person,
  }
  if (positional) {
    picture.personBefore = split.personBefore
    picture.personAfter = split.personAfter
  }
  return picture
}

export function editExpected(spec: Spec, positional: boolean) {
  const picture: Record<string, Value> = {
    phase: text(spec, "phase"),
    version: editVersion(spec),
    readAt: num(spec, "readAt"),
    guarded: flag(spec, "guarded"),
    agent: num(spec, "agent"),
    person: num(spec, "personBefore") + num(spec, "personAfter"),
  }
  if (positional) {
    picture.personBefore = num(spec, "personBefore")
    picture.personAfter = num(spec, "personAfter")
  }
  return picture
}
