import { readSlideState, type SlideCommand, type SlideId } from "@airdesign/document"

import { fieldRefusal, knownKeys, recordOf, type FieldRefusal } from "./wire.js"

export type WireSlide = SlideCommand & { readonly file: readonly SlideId[] }

const keysFor = {
  "element-add": ["slide", "id", "element", "file"],
  "element-remove": ["slide", "id", "node", "file"],
  "element-restore": ["slide", "id", "node", "file"],
  remove: ["slide", "id", "file"],
  move: ["slide", "id", "key", "file"],
  restore: ["slide", "id", "key", "file"],
  clone: ["slide", "id", "source", "key", "floor", "file"],
  add: ["slide", "id", "after", "key", "layout", "layoutPart", "floor", "file"],
} as const

function slideKeys(slide: unknown): readonly string[] | undefined {
  if (slide === "element-add") return keysFor["element-add"]
  if (slide === "element-remove") return keysFor["element-remove"]
  if (slide === "element-restore") return keysFor["element-restore"]
  if (slide === "remove") return keysFor.remove
  if (slide === "move") return keysFor.move
  if (slide === "restore") return keysFor.restore
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
  if (edit.slide === "element-add") return { slide: "element-add", id: edit.id, element: edit.element }
  if (edit.slide === "element-remove") return { slide: "element-remove", id: edit.id, node: edit.node }
  if (edit.slide === "element-restore") return { slide: "element-restore", id: edit.id, node: edit.node }
  if (edit.slide === "remove") return { slide: "remove", id: edit.id }
  if (edit.slide === "move") return { slide: "move", id: edit.id, key: edit.key }
  if (edit.slide === "restore") return { slide: "restore", id: edit.id, key: edit.key }
  const floor = edit.floor === undefined ? {} : { floor: edit.floor }
  if (edit.slide === "clone") return { slide: "clone", id: edit.id, source: edit.source, key: edit.key, ...floor }
  const part = edit.layoutPart === undefined ? {} : { layoutPart: edit.layoutPart }
  return { slide: "add", id: edit.id, after: edit.after, key: edit.key, layout: edit.layout, ...part, ...floor }
}
