import type { EditRefusal, DoomRefusal } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

export type ToolText = { readonly type: "text"; readonly text: string }
export type ToolImage = {
  readonly type: "image"
  readonly data: string
  readonly mimeType: "image/jpeg"
  readonly text?: undefined
}
export type ToolContent = ToolText | ToolImage

export type ToolResult = {
  readonly ok: boolean
  readonly content: readonly ToolContent[]
  readonly answer: Readonly<Record<string, unknown>>
}

export const refusalWords = {
  field:
    "A field is missing, unknown or the wrong form. Send only the fields the input schema lists, each in its described form.",
  deck: "This session can reach no deck with this id. airdesign_list_decks lists the decks you own.",
  owner: "This deck belongs to another account. Work only on decks this account owns.",
  base: "base is a rev airdesign_read_deck answered, and this deck has not reached it. Read the deck, then send the edit with that rev.",
  batch: "changes is missing or not a list of one to one hundred changes.",
  limit: "A value, the deck or a slide is over its limit: the words of a layer, the layers of the deck, or its slides.",
  kind: "A change moves a layer into itself or into a layer that cannot hold it.",
  dead: "A layer or slide you named is not in the deck, or an earlier change in this edit deleted it. For a move, that includes a frame above the frame you move the layer into. airdesign_read_deck lists the ids.",
  stale:
    "A person changed those words or list after you read them, and nothing landed. Read the deck, then send the change again with the new rev as base.",
  "person-protected":
    "A person changed this layer during your run, so it is closed to you, and nothing landed. Leave it, or send the edit without runId to start a new run.",
  "run-fenced":
    "That run has stopped, never started, or is another agent's, and nothing landed. Send the edit without runId to start a new run.",
  "last-slide":
    "A deck keeps at least one slide, so nothing landed. Leave one slide in the deck, or add the new slide in the same edit.",
  payload: "The deck is too large for this call, and nothing landed.",
  store: "The deck could not be read or saved, and nothing changed. Send the call again.",
} as const satisfies Partial<Record<EditRefusal, string>>

export type Refused = keyof typeof refusalWords

const doomCodes = {
  shape: "field",
  limit: "limit",
  cycle: "kind",
  person: "person-protected",
  missing: "dead",
  stale: "stale",
  "run-fenced": "run-fenced",
  "last-slide": "last-slide",
} as const satisfies Record<doom.Refusal["refused"], Refused>

const hostCodes = {
  session: "owner",
  field: "field",
  deck: "deck",
  owner: "owner",
  payload: "payload",
  cursor: "field",
  size: "payload",
  stale: "stale",
  server: "store",
} as const satisfies Record<Exclude<DoomRefusal["refusal"], "edit">, Refused>

export function told(ok: boolean, answer: Readonly<Record<string, unknown>>): ToolResult {
  return { ok, content: [{ type: "text", text: JSON.stringify(answer) }], answer }
}

export function answered(note: string, answer: Readonly<Record<string, unknown>>): ToolResult {
  return told(true, { ...answer, note })
}

export function limited(note: string): ToolResult {
  return told(false, { ok: false, refusal: "rate", note })
}

type Where = {
  readonly change?: string
  readonly at?: number
  readonly field?: string
  readonly node?: string
  readonly prop?: string
}

function whereWords(where: Where): string {
  const change =
    where.at === undefined
      ? ""
      : `Change ${String(where.at + 1)}${where.change === undefined ? "" : ` (${where.change})`}`
  const named = [
    ...(where.field === undefined ? [] : [`field ${where.field}`]),
    ...(where.node === undefined ? [] : [`layer ${where.node}`]),
    ...(where.prop === undefined ? [] : [`property ${where.prop}`]),
  ].join(", ")
  return [change, named].filter((part) => part !== "").join(": ")
}

function fieldNote(fault: unknown, form: unknown): string | undefined {
  const problem = fault === "missing" || fault === "unknown" ? fault : fault === "form" ? "the wrong form" : undefined
  if (problem === undefined) return undefined
  const sentence = `${problem[0]!.toUpperCase()}${problem.slice(1)}.`
  return typeof form === "string" && form !== "" ? `${sentence} Accepted form: ${form}` : sentence
}

export function refused(code: Refused, more: Where & Readonly<Record<string, unknown>> = {}): ToolResult {
  const where = whereWords(more)
  const specific = code === "field" ? fieldNote(more.fault, more.form) : undefined
  const words = specific ?? refusalWords[code]
  return told(false, {
    ok: false,
    refusal: code,
    ...more,
    note: where === "" ? words : `${where}. ${words}`,
  })
}

export function doomRefused(refusal: doom.AgentRefusal | doom.Refusal, more: Readonly<Record<string, unknown>> = {}) {
  return refused(doomCodes[refusal.refused], {
    refused: refusal.refused,
    ...("change" in refusal ? { change: refusal.change } : {}),
    ...("at" in refusal && refusal.at !== undefined ? { at: refusal.at } : {}),
    ...("field" in refusal && refusal.field !== undefined ? { field: refusal.field } : {}),
    ...("fault" in refusal && refusal.fault !== undefined ? { fault: refusal.fault } : {}),
    ...("form" in refusal && refusal.form !== undefined ? { form: refusal.form } : {}),
    ...(refusal.node === undefined ? {} : { node: refusal.node }),
    ...(refusal.prop === undefined ? {} : { prop: refusal.prop }),
    ...more,
  })
}

export function hostRefused(refusal: DoomRefusal): ToolResult {
  if (refusal.refusal !== "edit") return refused(hostCodes[refusal.refusal])
  return doomRefused(refusal)
}
