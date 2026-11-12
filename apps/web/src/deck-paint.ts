import { readElementId, slideId, type ElementId, type Register, type TextValue } from "@airdesign/document"
import {
  applyRoute,
  paintReader,
  paintKind,
  readShapes,
  readSlides,
  sectionStarts,
  type ReadShape,
  type SectionStart,
} from "@airdesign/pptx"
import type { PaintStore } from "@airdesign/render"
import { slideCanvases, type SlideCanvases } from "@/canvas-slide"
import type { TextBox } from "@/commit-edit"
import { boxStorable, landedBox } from "@/element-move"
import { editedParts, slideBase, storedText } from "@/exported-parts"
import { pictureSources, type PictureSources } from "@/picture-fill"
import { shownValue, type BusyElements } from "@/live-repaint"
import { fallbackPrompt } from "@/copy/placeholder-copy"
import { tableEditable } from "@/table-edit"

type NamedShape = { readonly id: ElementId; readonly shape: ReadShape }

function namedShapes(parts: ReadonlyMap<string, Uint8Array>): readonly NamedShape[] {
  const named: NamedShape[] = []
  for (const shape of readShapes(parts)) {
    const id = readElementId(`${shape.slide}.${shape.shape}`)
    if (id !== undefined) named.push({ id, shape })
  }
  return named
}

export function elementIds(parts: ReadonlyMap<string, Uint8Array>): readonly ElementId[] {
  return namedShapes(parts).map((named) => named.id)
}

function trialValue(value: TextValue): TextValue | null {
  for (let paragraph = value.length - 1; paragraph >= 0; paragraph -= 1) {
    const runs = value[paragraph]?.runs ?? []
    for (let run = runs.length - 1; run >= 0; run -= 1) {
      const found = runs[run]
      if (found === undefined || found.text === "\n") continue
      return value.map((each, index) =>
        index === paragraph
          ? {
              from: each.from,
              runs: runs.map((kept, at) => (at === run ? { ...kept, text: `${kept.text}.` } : kept)),
            }
          : each,
      )
    }
  }
  const first = value[0]
  if (first === undefined) return null
  return [{ from: first.from, runs: [...first.runs, { from: -1, text: "." }] }, ...value.slice(1)]
}

export function valueStorable(
  parts: ReadonlyMap<string, Uint8Array>,
  shape: ReadShape,
  value: TextValue | null,
): boolean {
  if (value === null) return false
  try {
    applyRoute(parts, {
      name: "text",
      part: shape.part,
      shape: shape.shape,
      value,
    })
    return true
  } catch {
    return false
  }
}

export function paint(
  store: PaintStore,
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register | null,
  busy: BusyElements,
): {
  readonly count: number
  readonly sections: readonly SectionStart[]
  readonly canvases: SlideCanvases
  readonly boxes: ReadonlyMap<ElementId, TextBox>
  readonly movables: ReadonlyMap<ElementId, TextBox>
  readonly shapes: ReadonlyMap<ElementId, ReadShape>
  readonly pictures: PictureSources
  readonly files: ReadonlyMap<ElementId, string>
  readonly base: ReadonlyMap<string, Uint8Array>
} {
  const base = register === null ? parts : slideBase(parts, register)
  const display = register !== null && register.order.length > 0 ? editedParts(base, register) : parts
  const named = namedShapes(display)
  const based = new Map(namedShapes(base).map((each) => [each.id, each.shape]))
  const ids = named.map((each) => each.id)
  const seen = new Map<ElementId, number>()
  for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1)
  const boxes = new Map<ElementId, TextBox>()
  const movables = new Map<ElementId, TextBox>()
  const rows = new Map<ElementId, ReadShape>()
  const files = new Map<ElementId, string>()
  for (const { id, shape: shown } of named) {
    const shape = based.get(id) ?? shown
    const kind = paintKind(shown.kind)
    const file = storedText(shape.text)
    files.set(id, file)
    if (!busy.has(id) || store.getElement(id) === null) {
      store.publish({ id, kind, text: shownValue(register, id, file), picture: kind === "picture" ? "" : null })
      store.placeBox(id, landedBox(register, id))
    }
    const holding = base.has(shape.part) ? base : null
    const table = holding !== null && shape.contentKind === "table" && tableEditable(holding, shape)
    if (holding !== null && seen.get(id) === 1 && (table || boxStorable(holding, shape))) movables.set(id, { id, file })
    const storable =
      holding !== null &&
      seen.get(id) === 1 &&
      (table || (!shape.locked && valueStorable(holding, shape, trialValue(shape.text))))
    if (!storable) continue
    boxes.set(id, { id, file })
    rows.set(id, shape)
  }
  const read = readSlides(display).map(({ slide, part }) => ({
    slide,
    part,
    named: named.filter((each) => each.shape.slide === slide),
  }))
  store.setSlides(read.map((each) => ({ id: slideId(each.slide), elements: each.named.map((shape) => shape.id) })))
  const sources = read.map((each) => ({
    part: each.part,
    shapes: new Map(
      each.named.map(({ id, shape }) => [
        shape.shape,
        { id, kind: paintKind(shape.kind), editable: boxes.has(id), movable: movables.has(id) },
      ]),
    ),
  }))
  const pictures = pictureSources(display)
  const texts = display === base ? undefined : paintReader(base, { fallbackPrompt })
  const canvases = slideCanvases(paintReader(display, { fallbackPrompt }), sources, pictures.src, texts)
  return {
    count: read.length,
    sections: sectionStarts(display),
    canvases,
    boxes,
    movables,
    shapes: rows,
    pictures,
    files,
    base,
  }
}
