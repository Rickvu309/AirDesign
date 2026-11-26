import * as doom from "@airdesign/doom"

import { recordOf } from "./wire.js"

const { op, kind } = doom.agentChangesSchema.$defs.change.properties
const editOps = op.enum.filter((value) => value !== "component")
const addKinds = kind.enum.filter((value) => value !== "component")

export function readDeckChange(raw: unknown): doom.AgentChange | doom.Refusal {
  const change = recordOf(raw)
  if (change?.op === "component") return { refused: "shape", field: "op", form: editOps.join(", ") }
  if (change?.op === "add" && change.kind === "component")
    return { refused: "shape", field: "kind", form: addKinds.join(", ") }
  if (change !== undefined && Object.hasOwn(change, "component"))
    return { refused: "shape", field: "component", fault: "unknown" }
  return doom.readAgentChange(raw)
}
