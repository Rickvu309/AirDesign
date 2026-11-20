import { authorableSlide } from "./authoring.js"
import { readSlideState, type SlideCommand, type SlideId } from "@airdesign/document"

import { fieldRefusal, knownKeys, recordOf, type FieldRefusal } from "./wire.js"

export type WireSlide = SlideCommand & { readonly file: readonly SlideId[] }

const keysFor = {
  "element-add": ["slide", "id", "element", "media", "geometry", "pasted", "file"],
  "element-clone": ["slide", "id", "source", "element", "layers", "file"],
  "element-remove": ["slide", "id", "node", "file"],
  "element-restore": ["slide", "id", "node", "file"],
  "element-order": ["slide", "id", "node", "before", "among", "file"],
  "element-group": ["slide", "id", "element", "members", "backdrop", "file"],
  "element-ungroup": ["slide", "id", "node", "file"],
  "element-regroup": ["slide", "id", "node", "file"],
  "element-join": ["slide", "id", "member", "frame", "before", "file"],
  remove: ["slide", "id", "file"],
  move: ["slide", "id", "key", "file"],
  restore: ["slide", "id", "key", "file"],
  clone: ["slide", "id", "source", "key", "floor", "file"],
  add: ["slide", "id", "after", "key", "layout", "layoutPart", "floor", "file"],
} as const

function slideKeys(slide: unknown): readonly string[] | undefined {
  if (slide === "element-add") return keysFor["element-add"]
  if (slide === "element-clone") return keysFor["element-clone"]
  if (slide === "element-remove") return keysFor["element-remove"]
  if (slide === "element-restore") return keysFor["element-restore"]
  if (slide === "element-order") return keysFor["element-order"]
  if (slide === "element-group") return keysFor["element-group"]
  if (slide === "element-ungroup") return keysFor["element-ungroup"]
  if (slide === "element-regroup") return keysFor["element-regroup"]
  if (slide === "element-join") return keysFor["element-join"]
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
  const keys =
    body.grid === 1 || body.grid === 2 || body.grid === 3
      ? body.slide === "remove-many"
        ? ["slide", "grid", "ids", "file"]
        : body.slide === "clone-many"
          ? ["slide", "grid", "copies", "file"]
          : body.slide === "move-many"
            ? ["slide", "grid", "ids", body.row === "before" ? "before" : "after", "row", "file"]
            : body.slide === "grid-turn"
              ? ["slide", "grid", "turn", "file"]
              : body.slide === "move"
                ? ["slide", "grid", "id", "after", "row", "file"]
                : body.slide === "add"
                  ? ["slide", "grid", "id", "after", "row", "layout", "layoutPart", "floor", "file"]
                  : body.slide === "clone"
                    ? ["slide", "grid", "id", "source", "floor", "file"]
                    : body.slide === "remove"
                      ? ["slide", "grid", "id", "file"]
                      : undefined
      : slideKeys(body.slide)
  if (keys === undefined || !knownKeys(body, keys)) return fieldRefusal
  const state = readSlideState({ file: body.file, order: [body] })
  const edit = state?.order[0]
  if (state === undefined || edit === undefined || !authorableSlide(edit)) return fieldRefusal
  return { ok: true, edit: { ...edit, file: state.file } }
}

export function slideEditCommand(edit: WireSlide): SlideCommand {
  if (edit.grid !== undefined) {
    const { file: _file, ...command } = edit
    return command
  }
  if (edit.slide === "element-add") {
    const media = edit.media === undefined ? {} : { media: edit.media }
    const geometry = edit.geometry === undefined ? {} : { geometry: edit.geometry }
    const pasted = edit.pasted === undefined ? {} : { pasted: edit.pasted }
    return { slide: "element-add", id: edit.id, element: edit.element, ...media, ...geometry, ...pasted }
  }
  if (edit.slide === "element-clone") {
    const layers = edit.layers === undefined ? {} : { layers: edit.layers }
    return { slide: "element-clone", id: edit.id, source: edit.source, element: edit.element, ...layers }
  }
  if (edit.slide === "element-remove") return { slide: "element-remove", id: edit.id, node: edit.node }
  if (edit.slide === "element-restore") return { slide: "element-restore", id: edit.id, node: edit.node }
  if (edit.slide === "element-order") {
    return { slide: "element-order", id: edit.id, node: edit.node, before: edit.before, among: edit.among }
  }
  if (edit.slide === "element-group") {
    const backdrop = edit.backdrop === undefined ? {} : { backdrop: edit.backdrop }
    return { slide: "element-group", id: edit.id, element: edit.element, members: edit.members, ...backdrop }
  }
  if (edit.slide === "element-ungroup") return { slide: "element-ungroup", id: edit.id, node: edit.node }
  if (edit.slide === "element-regroup") return { slide: "element-regroup", id: edit.id, node: edit.node }
  if (edit.slide === "element-join")
    return { slide: "element-join", id: edit.id, member: edit.member, frame: edit.frame, before: edit.before }
  if (edit.slide === "remove") return { slide: "remove", id: edit.id }
  if (edit.slide === "move") return { slide: "move", id: edit.id, key: edit.key }
  if (edit.slide === "restore") return { slide: "restore", id: edit.id, key: edit.key }
  const floor = edit.floor === undefined ? {} : { floor: edit.floor }
  if (edit.slide === "clone") return { slide: "clone", id: edit.id, source: edit.source, key: edit.key, ...floor }
  const part = edit.layoutPart === undefined ? {} : { layoutPart: edit.layoutPart }
  return { slide: "add", id: edit.id, after: edit.after, key: edit.key, layout: edit.layout, ...part, ...floor }
}
