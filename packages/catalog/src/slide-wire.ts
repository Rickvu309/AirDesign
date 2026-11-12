import { readSlideState, type SlideCommand, type SlideId } from "@airdesign/document"

import { fieldRefusal, knownKeys, recordOf, type FieldRefusal } from "./wire.js"

export type WireSlide = SlideCommand & { readonly file: readonly SlideId[] }

const keysFor = {
  remove: ["slide", "id", "file"],
  move: ["slide", "id", "key", "file"],
  clone: ["slide", "id", "source", "key", "floor", "file"],
  add: ["slide", "id", "after", "key", "layout", "floor", "file"],
} as const

function slideKeys(slide: unknown): readonly string[] | undefined {
  if (slide === "remove") return keysFor.remove
  if (slide === "move") return keysFor.move
  if (slide === "clone") return keysFor.clone
  if (slide === "add") return keysFor.add
  return undefined
}

export function readSlideEdit(raw: unknown): { ok: true; edit: WireSlide } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined || !Object.hasOwn(body, "file")) return fieldRefusal
  const keys = slideKeys(body.slide)
  if (keys === undefined || !knownKeys(body, keys)) return fieldRefusal
  const state = readSlideState({ file: body.file, order: [body] })
  const edit = state?.order[0]
  if (state === undefined || edit === undefined) return fieldRefusal
  return { ok: true, edit: { ...edit, file: state.file } }
}

export function slideEditCommand(edit: WireSlide): SlideCommand {
  if (edit.slide === "remove") return { slide: "remove", id: edit.id }
  if (edit.slide === "move") return { slide: "move", id: edit.id, key: edit.key }
  const floor = edit.floor === undefined ? {} : { floor: edit.floor }
  if (edit.slide === "clone") return { slide: "clone", id: edit.id, source: edit.source, key: edit.key, ...floor }
  return { slide: "add", id: edit.id, after: edit.after, key: edit.key, layout: edit.layout, ...floor }
}
