import { limits } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import * as z from "zod/v4"

import { readSlidePictures, type SlidePictures } from "./slide-pictures-wire.js"
import { type DeckId, deckInput, inputRefusal, readCapture, readInput, recordOf, wholeInput } from "./wire.js"

export const doomRefusals = [
  "session",
  "field",
  "deck",
  "owner",
  "payload",
  "cursor",
  "size",
  "stale",
  "server",
] as const

export type DoomRefusal =
  | { readonly ok: false; readonly refusal: (typeof doomRefusals)[number] }
  | {
      readonly ok: false
      readonly refusal: "edit"
      readonly refused: doom.Refusal["refused"]
      readonly node?: doom.NodeId
      readonly prop?: doom.WriteKey
    }

export type DoomResult<Value> = ({ readonly ok: true } & Value) | DoomRefusal
export type DoomOpened = DoomResult<{ readonly deck: DeckId; readonly rev: number; readonly fold: doom.Doom }>
export type DoomLanded = DoomResult<{ readonly deck: DeckId; readonly rev: number }>
export type DoomPictured = DoomResult<{ readonly deck: DeckId; readonly missing: readonly doom.NodeId[] }>
export type DoomCaught = DoomResult<{
  readonly deck: DeckId
  readonly rev: number
  readonly edits: readonly unknown[]
  readonly pictures?: true
}>

export type DoomRan = DoomResult<{
  readonly deck: DeckId
  readonly rev: number
  readonly edits: readonly unknown[]
  readonly replaced: readonly unknown[]
}>

export const picturesWantedMilliseconds = 120_000

export const nodeIdPattern = new RegExp(doom.agentChangesSchema.$defs.id.pattern)

const payload: DoomRefusal = { ok: false, refusal: "payload" }
const refusedKinds: readonly string[] = ["shape", "limit", "cycle", "person", "missing", "stale", "run-fenced"]

export const readDoomEdit = readInput(
  z.strictObject({ deck: deckInput, edit: z.record(z.string(), z.unknown()) }),
  inputRefusal,
)

export const readDoomOpen = readInput(
  z.strictObject({ deck: deckInput, trashed: z.literal(true).optional() }),
  inputRefusal,
)

export const readDoomSince = readInput(
  z.strictObject({
    deck: deckInput,
    rev: wholeInput,
    wait: z.boolean().optional(),
    pictures: z.boolean().optional(),
  }),
  inputRefusal,
)

export const readDoomRun = readInput(
  z.strictObject({ deck: deckInput, run: z.string().min(1).max(limits.clientName) }),
  inputRefusal,
)

export const readDoomPictures = readInput(
  z.strictObject({
    deck: deckInput,
    rev: wholeInput,
    pictures: z.unknown().transform((raw, ctx): SlidePictures => {
      const read = readSlidePictures(raw)
      if (read === undefined) ctx.issues.push({ code: "custom", message: "pictures", input: raw })
      return read ?? { keys: [], images: [] }
    }),
  }),
  inputRefusal,
)

const whole = (raw: unknown): raw is number => typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0

function refusalOf(body: Record<string, unknown>): DoomRefusal {
  const { refusal } = body
  if (refusal === "edit") {
    const { refused, node, prop } = body
    if (typeof refused !== "string" || !refusedKinds.includes(refused)) return payload
    return {
      ok: false,
      refusal: "edit",
      refused: refused as doom.Refusal["refused"],
      ...(typeof node === "string" ? { node: node as doom.NodeId } : {}),
      ...(typeof prop === "string" ? { prop: prop as doom.WriteKey } : {}),
    }
  }
  return typeof refusal === "string" && (doomRefusals as readonly string[]).includes(refusal)
    ? { ok: false, refusal: refusal as (typeof doomRefusals)[number] }
    : payload
}

function decode<Value>(
  value: (body: Record<string, unknown>, deck: DeckId) => Value | undefined,
): (raw: unknown) => DoomResult<Value> {
  return (raw) => {
    const body = recordOf(raw)
    if (body === undefined) return payload
    if (body.ok === false) return refusalOf(body)
    const deck = readCapture({ deck: body.deck })
    if (body.ok !== true || !deck.ok) return payload
    const read = value(body, deck.deck)
    return read === undefined ? payload : { ok: true, ...read }
  }
}

const opened = decode((body, deck) => {
  const fold = doom.readFold(body.fold)
  return whole(body.rev) && fold !== undefined && fold.rev === body.rev ? { deck, rev: body.rev, fold } : undefined
})

const landed = decode((body, deck) => (whole(body.rev) ? { deck, rev: body.rev } : undefined))

const caught = decode((body, deck) =>
  whole(body.rev) && Array.isArray(body.edits)
    ? {
        deck,
        rev: body.rev,
        edits: body.edits as unknown[],
        ...(body.pictures === true ? { pictures: true as const } : {}),
      }
    : undefined,
)

const ran = decode((body, deck) =>
  whole(body.rev) &&
  Array.isArray(body.edits) &&
  Array.isArray(body.replaced) &&
  body.replaced.length === body.edits.length
    ? { deck, rev: body.rev, edits: body.edits as unknown[], replaced: body.replaced as unknown[] }
    : undefined,
)

const pictured = decode((body, deck) =>
  Array.isArray(body.missing) && body.missing.every((each) => doom.readNodeId(each) !== undefined)
    ? { deck, missing: body.missing as doom.NodeId[] }
    : undefined,
)

export const doomRoutes = {
  create: { path: "/doom/create", read: readCapture, result: opened },
  open: { path: "/doom/open", read: readDoomOpen, result: opened },
  edit: { path: "/doom/edit", read: readDoomEdit, result: landed },
  since: { path: "/doom/since", read: readDoomSince, result: caught },
  pictures: { path: "/doom/pictures", read: readDoomPictures, result: pictured },
  run: { path: "/doom/run", read: readDoomRun, result: ran },
} as const

export const doomPaths: readonly string[] = Object.values(doomRoutes).map((route) => route.path)
