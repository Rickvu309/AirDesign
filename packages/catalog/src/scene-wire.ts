import { limits, scene } from "@airdesign/document"
import * as z from "zod/v4"

import { readSlidePictures, type SlidePictures } from "./slide-pictures-wire.js"
import { type DeckId, deckInput, inputRefusal, readCapture, readInput, recordOf, wholeInput } from "./wire.js"

export const sceneRefusals = [
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

export type SceneRefusal =
  | { readonly ok: false; readonly refusal: (typeof sceneRefusals)[number] }
  | {
      readonly ok: false
      readonly refusal: "edit"
      readonly refused: scene.Refusal["refused"]
      readonly node?: scene.NodeId
      readonly prop?: scene.WriteKey
    }

export type SceneResult<Value> = ({ readonly ok: true } & Value) | SceneRefusal
export type SceneOpened = SceneResult<{ readonly deck: DeckId; readonly rev: number; readonly fold: scene.Scene }>
export type SceneLanded = SceneResult<{ readonly deck: DeckId; readonly rev: number }>
export type ScenePictured = SceneResult<{ readonly deck: DeckId; readonly missing: readonly scene.NodeId[] }>
export type SceneCaught = SceneResult<{
  readonly deck: DeckId
  readonly rev: number
  readonly edits: readonly unknown[]
  readonly pictures?: true
}>

export type SceneRan = SceneResult<{
  readonly deck: DeckId
  readonly rev: number
  readonly edits: readonly unknown[]
  readonly before: Readonly<Record<string, unknown>>
}>

export const picturesWantedMilliseconds = 120_000

export const nodeIdPattern = new RegExp(scene.agentChangesSchema.$defs.id.pattern)

const readNodeId = (raw: unknown): scene.NodeId | undefined =>
  typeof raw === "string" && nodeIdPattern.test(raw) ? (raw as scene.NodeId) : undefined

const payload: SceneRefusal = { ok: false, refusal: "payload" }
const refusedKinds: readonly string[] = ["shape", "limit", "cycle", "person", "missing", "stale", "run-fenced"]

export const readSceneEdit = readInput(
  z.strictObject({ deck: deckInput, edit: z.record(z.string(), z.unknown()) }),
  inputRefusal,
)

export const readSceneSince = readInput(
  z.strictObject({
    deck: deckInput,
    rev: wholeInput,
    wait: z.boolean().optional(),
    pictures: z.boolean().optional(),
  }),
  inputRefusal,
)

export const readSceneRun = readInput(
  z.strictObject({ deck: deckInput, run: z.string().min(1).max(limits.clientName) }),
  inputRefusal,
)

export const readScenePictures = readInput(
  z.strictObject({
    deck: deckInput,
    rev: wholeInput,
    pictures: z.unknown().transform((raw, ctx): SlidePictures<scene.NodeId> => {
      const read = readSlidePictures(raw, readNodeId)
      if (read === undefined) ctx.issues.push({ code: "custom", message: "pictures", input: raw })
      return read ?? { keys: [], images: [] }
    }),
  }),
  inputRefusal,
)

const whole = (raw: unknown): raw is number => typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0

function refusalOf(body: Record<string, unknown>): SceneRefusal {
  const { refusal } = body
  if (refusal === "edit") {
    const { refused, node, prop } = body
    if (typeof refused !== "string" || !refusedKinds.includes(refused)) return payload
    return {
      ok: false,
      refusal: "edit",
      refused: refused as scene.Refusal["refused"],
      ...(typeof node === "string" ? { node: node as scene.NodeId } : {}),
      ...(typeof prop === "string" ? { prop: prop as scene.WriteKey } : {}),
    }
  }
  return typeof refusal === "string" && (sceneRefusals as readonly string[]).includes(refusal)
    ? { ok: false, refusal: refusal as (typeof sceneRefusals)[number] }
    : payload
}

function decode<Value>(
  value: (body: Record<string, unknown>, deck: DeckId) => Value | undefined,
): (raw: unknown) => SceneResult<Value> {
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
  const fold = scene.readFold(body.fold)
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

const ran = decode((body, deck) => {
  const before = recordOf(body.before)
  return whole(body.rev) && Array.isArray(body.edits) && before !== undefined
    ? { deck, rev: body.rev, edits: body.edits as unknown[], before }
    : undefined
})

const pictured = decode((body, deck) =>
  Array.isArray(body.missing) && body.missing.every((each) => readNodeId(each) !== undefined)
    ? { deck, missing: body.missing as scene.NodeId[] }
    : undefined,
)

export const sceneRoutes = {
  create: { path: "/scenes/create", read: readCapture, result: opened },
  open: { path: "/scenes/open", read: readCapture, result: opened },
  edit: { path: "/scenes/edit", read: readSceneEdit, result: landed },
  since: { path: "/scenes/since", read: readSceneSince, result: caught },
  pictures: { path: "/scenes/pictures", read: readScenePictures, result: pictured },
  run: { path: "/scenes/run", read: readSceneRun, result: ran },
} as const

export const scenePaths: readonly string[] = Object.values(sceneRoutes).map((route) => route.path)
