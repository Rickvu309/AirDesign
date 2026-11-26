import * as z from "zod/v4"

import {
  deckInput,
  deckPattern,
  inputRefusal,
  readInput,
  recordOf,
  type DeckRefusal,
  type FieldRefusal,
} from "./wire.js"

export const scriptBytes = 100_000

const forms = {
  fields: "One of deck, script, runId.",
  script: `JavaScript, 1 to ${scriptBytes.toLocaleString("en")} characters.`,
  runId: "The runId a call answered: 1 to 64 of letters, digits, _ or -.",
} as const

function executeRefusal(issues: readonly z.core.$ZodIssue[], raw: unknown): FieldRefusal | DeckRefusal {
  const extra = issues.find((issue) => issue.code === "unrecognized_keys")
  if (extra !== undefined && extra.code === "unrecognized_keys")
    return { ok: false, refusal: "field", field: String(extra.keys[0]), fault: "unknown", form: forms.fields }
  const field = issues.find((issue) => issue.path.length > 0)?.path[0]
  if (field !== "script" && field !== "runId") return inputRefusal(issues, raw)
  const sent = Object.hasOwn(recordOf(raw) ?? {}, field)
  return { ok: false, refusal: "field", field, fault: sent ? "form" : "missing", form: forms[field] }
}

export const readExecute = readInput(
  z.strictObject({
    deck: deckInput,
    script: z
      .string()
      .min(1)
      .max(scriptBytes)
      .describe("JavaScript with the operation functions, get, screenshot and print. Its last value is the result."),
    runId: z
      .string()
      .regex(deckPattern)
      .describe("The runId your last call answered. Left out: this call starts a new run.")
      .exactOptional(),
  }),
  executeRefusal,
)
