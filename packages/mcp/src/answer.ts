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
  dead: "A layer or slide you named is not in the deck. airdesign_read_deck lists the ids.",
  stale:
    "A person changed those words or list after you read them, and nothing landed. Read the deck, then send the change again with the new rev as base.",
  "person-protected":
    "A person changed this layer during your run, so it is closed to you, and nothing landed. Leave it, or send the edit without runId to start a new run.",
  "run-fenced":
    "That run has stopped, never started, or is another agent's, and nothing landed. Send the edit without runId to start a new run.",
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

export function answered(lead: string, answer: Readonly<Record<string, unknown>>, body?: string): ToolResult {
  return {
    ok: true,
    content: [
      { type: "text", text: lead },
      ...(body === undefined ? [] : [{ type: "text" as const, text: body }]),
      { type: "text", text: JSON.stringify(answer) },
    ],
    answer,
  }
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

export function refused(code: Refused, more: Where & Readonly<Record<string, unknown>> = {}): ToolResult {
  const answer = { ok: false, refusal: code, ...more }
  const where = whereWords(more)
  return {
    ok: false,
    content: [
      { type: "text", text: where === "" ? refusalWords[code] : `${where}. ${refusalWords[code]}` },
      { type: "text", text: JSON.stringify(answer) },
    ],
    answer,
  }
}

export function doomRefused(refusal: doom.AgentRefusal | doom.Refusal, more: Readonly<Record<string, unknown>> = {}) {
  return refused(doomCodes[refusal.refused], {
    refused: refusal.refused,
    ...("change" in refusal ? { change: refusal.change } : {}),
    ...("at" in refusal && refusal.at !== undefined ? { at: refusal.at } : {}),
    ...("field" in refusal && refusal.field !== undefined ? { field: refusal.field } : {}),
    ...(refusal.node === undefined ? {} : { node: refusal.node }),
    ...(refusal.prop === undefined ? {} : { prop: refusal.prop }),
    ...more,
  })
}

export function hostRefused(refusal: DoomRefusal): ToolResult {
  if (refusal.refusal !== "edit") return refused(hostCodes[refusal.refusal])
  return doomRefused(refusal)
}
