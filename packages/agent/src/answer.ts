import { refusalCopy, type EditRefusal, type DoomRefusal } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

import type { DeckHost } from "./deck-host.js"

export type Answer = {
  readonly ok: boolean
  readonly fields: Readonly<Record<string, unknown>>
  readonly screenshots: readonly string[]
}

export const refusalWords = {
  field:
    "A field is missing, unknown or the wrong form. Send only the fields the input schema lists, each in its described form.",
  deck: "This session can reach no deck with this id. airdesign_get_app_state lists the decks you own.",
  owner: "This deck belongs to another account. Work only on decks this account owns.",
  limit: "A value, the deck or a slide is over its limit: the words of a layer, the layers of the deck, or its slides.",
  kind: "An operation moves a layer into itself or into a layer that cannot hold it.",
  dead: "A layer or slide you named is not in the deck, or an earlier operation in this call removed it. For a move, that includes a frame above the frame you move the layer into. get() lists the ids.",
  stale: "The deck changed while the call ran. Read it with get in a separate call, then revise your edit.",
  "person-protected":
    "A person changed this layer during your run, so it is closed to you, and nothing landed. Leave it, or read it again and send the edit without runId to start a new run.",
  "run-fenced":
    "That run has stopped, never started, or is another agent's, and nothing landed. Send the call without runId to start a new run.",
  "last-slide":
    "A deck keeps at least one slide, so nothing landed. Leave one slide in the deck, or add the new slide in the same call.",
  payload: "The deck is too large for this call, and nothing landed.",
  store: "The deck could not be read or saved, and nothing changed. Send the call again.",
  fonts:
    "A frame you set to layout none holds words AirDesign could not measure, so its layers could not stay where they are painted, and nothing landed. If the answer names characters, set those layers in a font AirDesign serves that covers them; otherwise send the call again.",
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

export function told(ok: boolean, fields: Readonly<Record<string, unknown>>): Answer {
  return { ok, fields, screenshots: [] }
}

export function answered(note: string, fields: Readonly<Record<string, unknown>>): Answer {
  return told(true, { ...fields, note })
}

export async function unadmitted(host: DeckHost, kind: "tool" | "deck"): Promise<Answer | undefined> {
  try {
    const admission = await host.admit(kind)
    return admission.ok ? undefined : told(false, { ok: false, refusal: "rate", note: admission.text })
  } catch {
    return refused("store")
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

function fieldNote(fault: unknown, form: unknown, needs: unknown): string | undefined {
  if (fault === "needs" || (typeof needs === "string" && needs !== "")) {
    return typeof needs === "string" && needs !== "" ? `Needs ${needs}.` : undefined
  }
  const problem = fault === "missing" || fault === "unknown" ? fault : fault === "form" ? "the wrong form" : undefined
  if (problem === undefined) return undefined
  const sentence = `${problem[0]!.toUpperCase()}${problem.slice(1)}.`
  return typeof form === "string" && form !== "" ? `${sentence} Accepted form: ${form}` : sentence
}

export function gridNeeds(grid: doom.GridShortfall): string {
  if ("rows" in grid)
    return `fewer than ${String(grid.rows)} rows or a taller box: at ${grid.style} size they need ${String(grid.needs)} px and the box has ${String(grid.room)} px`
  const { row, col, word, needs, room } = grid.cell
  const more = grid.more === 0 ? "" : ` (and ${String(grid.more)} more ${grid.more === 1 ? "cell" : "cells"})`
  return `a shorter word than “${word}” in row ${String(row + 1)}, column ${String(col + 1)}, which needs ${String(needs)} px at ${grid.style} size in a column of ${String(room)} px${more}; or fewer columns or a wider box`
}

export function refused(code: Refused, more: Where & Readonly<Record<string, unknown>> = {}): Answer {
  const where = whereWords(more)
  const specific =
    more.fault !== undefined || more.needs !== undefined
      ? fieldNote(more.fault, more.form, more.needs)
      : typeof more.form === "string"
        ? more.form
        : undefined
  const words = specific ?? (typeof more.note === "string" ? more.note : refusalWords[code])
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
    ...refusalCopy(refusal),
    ...("grid" in refusal && refusal.grid !== undefined ? { needs: gridNeeds(refusal.grid) } : {}),
    ...(refusal.node === undefined ? {} : { node: refusal.node }),
    ...(refusal.prop === undefined ? {} : { prop: refusal.prop }),
    ...more,
  })
}

export function hostRefused(refusal: DoomRefusal): Answer {
  if (refusal.refusal !== "edit") return refused(hostCodes[refusal.refusal])
  return doomRefused(refusal)
}
