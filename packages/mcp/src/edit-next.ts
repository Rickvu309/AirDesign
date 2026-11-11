import type { readAgentEdit, EditRefusal } from "@airdesign/catalog"
import { limits } from "@airdesign/document"

type Refused<Result> = Result extends { readonly ok: false; readonly refusal: infer Code } ? Code : never

export type ReadCode = Refused<ReturnType<typeof readAgentEdit>>

export type EditCode = EditRefusal

const valueBytes = limits.valueBytes.toLocaleString("en-US")

export const editNext = {
  stale: "The element changed since it was read. Use the value and version in this answer and send the change again.",
  "person-protected":
    "A person edited this element during this run. It is closed to this run. Do not send this change again.",
  "run-fenced":
    "This turn's run has ended on an element this call names, or another run holds one of them, and nothing landed. Call airdesign_stop_run with the runId your edit answers carried to end the turn, then edit in a new turn.",
  limit: `The value is over ${valueBytes} bytes, or the deck is at its size, element or slide limit. Send a shorter value, or tell the person the deck is full.`,
  dead: "The deck has no element with this id. Check the element id.",
  present: "This element is already in the deck. Check the element id.",
  deck: "This session can reach no deck with this id. Check the deck id.",
  owner: "This deck belongs to another account. Work only on decks this account owns.",
  deleted: "This deck was deleted for good, and nothing landed. Do not send changes to it again.",
  base: "The base is missing or not a whole number. Send the revision from your last answer as base.",
  batch: "The changes are missing or not a list of one to one hundred changes. Send one to one hundred changes.",
  payload: "The deck's next revision could not be named for storage, and nothing landed. Tell the person.",
  field:
    "A field is missing or has the wrong form. Send only the fields the input schema lists, each in its described form.",
  "text-from":
    "A from index in this value is not one the file has, and nothing landed. Use an index listed next, or -1 for a new run.",
  store: "The deck could not be reached, and nothing landed. Try again later.",
} as const satisfies Record<EditCode, string>

export const editCodes = Object.keys(editNext) as EditCode[]

export const runNext = {
  ...editNext,
  stale: "The deck changed while this call ran, and nothing changed. Call this tool again.",
  "run-fenced": "This deck has no run with this id, and nothing changed. Use the runId an edit answer carried.",
  limit: "The deck is at its element limit, so this run could not be ended, and nothing changed. Tell the person.",
} as const satisfies Record<EditCode, string>

export function editSentence(code: EditCode): string {
  return editNext[code]
}

export function runSentence(code: EditCode): string {
  return runNext[code]
}
