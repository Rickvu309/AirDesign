import { limits } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import * as z from "zod/v4"

import {
  baseRefusal,
  deckInput,
  deckPattern,
  fieldRefusal,
  inputRefusal,
  readInput,
  recordOf,
  wholeInput,
  type BaseRefusal,
  type BatchRefusal,
  type DeckRefusal,
  type FieldRefusal,
} from "./wire.js"

const { $defs, properties } = doom.agentChangesSchema
const { op, kind, ...otherFields } = $defs.change.properties
const lookFields = Object.fromEntries(
  Object.entries(otherFields).filter(([name]) => name !== "component" && name !== "spec"),
)
const editOps = op.enum.filter((value) => value !== "component")
const addKinds = kind.enum.filter((value) => value !== "component")
const editDefs = {
  ...$defs,
  change: {
    ...$defs.change,
    properties: {
      op: { ...op, enum: editOps },
      kind: { ...kind, enum: addKinds },
      ...lookFields,
    },
  },
}

export function readDeckChange(raw: unknown): doom.AgentChange | doom.Refusal {
  const change = recordOf(raw)
  if (change?.op === "component") return { refused: "shape", field: "op", form: editOps.join(", ") }
  if (change?.op === "add" && change.kind === "component")
    return { refused: "shape", field: "kind", form: addKinds.join(", ") }
  if (change !== undefined && Object.hasOwn(change, "component"))
    return { refused: "shape", field: "component", fault: "unknown" }
  return doom.readAgentChange(raw)
}

const idForm = "1 to 64 of letters, digits, _ or -."
const changesForm = `1 to ${String(limits.batch)} changes.`
const editForm = "One of deck, base, runId, changes."

function unknownField(issues: readonly z.core.$ZodIssue[]): string | undefined {
  for (const issue of issues) {
    if (issue.code !== "unrecognized_keys") continue
    const key = issue.keys[0]
    return typeof key === "string" ? key : "extra"
  }
  return undefined
}

export const readDeckEdit = readInput(
  z
    .strictObject({
      deck: deckInput,
      base: wholeInput.describe("The rev airdesign_read_deck answered."),
      runId: z
        .string()
        .regex(deckPattern)
        .describe("The runId your last edit answered. Left out: this edit starts a new run.")
        .exactOptional(),
      changes: z.array(z.unknown()).min(1).max(limits.batch).meta(properties.changes),
    })
    .meta({ $defs: editDefs }),
  (issues, raw): FieldRefusal | DeckRefusal | BaseRefusal | BatchRefusal => {
    const unknown = unknownField(issues)
    if (unknown !== undefined) return { ok: false, refusal: "field", field: unknown, fault: "unknown", form: editForm }
    const body = recordOf(raw)
    const deckIssue = issues.find((issue) => issue.path[0] === "deck")
    if (deckIssue !== undefined) {
      if (body !== undefined && Object.hasOwn(body, "deck")) return inputRefusal(issues, raw)
      return { ok: false, refusal: "field", field: "deck", fault: "missing", form: idForm }
    }
    if (issues.some((issue) => issue.path.length === 0)) return fieldRefusal
    if (issues.some((issue) => issue.path[0] === "base")) return baseRefusal
    const changes = issues.find((issue) => issue.path.length === 1 && issue.path[0] === "changes")
    if (changes !== undefined) {
      const fault = body !== undefined && Object.hasOwn(body, "changes") ? "form" : "missing"
      return { ok: false, refusal: "batch", field: "changes", fault, form: changesForm }
    }
    const named = issues.find((issue) => issue.path.length > 0)
    if (named === undefined) return fieldRefusal
    const key = named.path[0]
    const name = typeof key === "string" ? key : "input"
    if (name === "runId") return { ok: false, refusal: "field", field: "runId", fault: "form", form: idForm }
    return { ok: false, refusal: "field", field: name, fault: "form" }
  },
)
