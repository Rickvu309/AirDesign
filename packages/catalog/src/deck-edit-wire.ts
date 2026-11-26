import * as doom from "@airdesign/doom"

import { recordOf } from "./wire.js"

const properties = doom.agentChangesSchema.$defs.change.properties
const templateFields = ["component", "spec", "data", "variant", "tokens", "focus"]
export const deckChangeWords = {
  fields: Object.keys(properties).filter((field) => !templateFields.includes(field)),
  ops: properties.op.enum.filter((value) => value !== "component" && value !== "detach"),
  kinds: properties.kind.enum.filter((value) => value !== "component"),
}

export function readDeckChange(raw: unknown): doom.AgentChange | doom.Refusal {
  const change = recordOf(raw)
  if (change?.op === "component" || change?.op === "detach")
    return { refused: "shape", field: "op", form: deckChangeWords.ops.join(", ") }
  if (change?.op === "add" && change.kind === "component")
    return { refused: "shape", field: "kind", form: deckChangeWords.kinds.join(", ") }
  const field = change === undefined ? undefined : templateFields.find((name) => Object.hasOwn(change, name))
  if (field !== undefined) return { refused: "shape", field, fault: "unknown" }
  return doom.readAgentChange(raw)
}
