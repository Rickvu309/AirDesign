import {
  elementsUndoable,
  nextElementId,
  plainSlideNumber,
  readElementId,
  readSlideId,
  readTextValue,
  shapeOf,
  writeTextValue,
  type ElementId,
  type Register,
  type SlideNumber,
  type SlideCommand,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { freeShapeId, paintReader, readShapes, readShows, slideNumberBox } from "@airdesign/pptx"
import { flushPending } from "@/commit-edit"
import { boxOf } from "@airdesign/render"
import { exportedParts, slideBase } from "@/exported-parts"
import { shownValue } from "@/live-repaint"
import { fileSlides } from "@/slide-edit"
import type { InsertingDeck } from "./inserts"
import type { RecordHold } from "@/undo-list"

type Parts = ReadonlyMap<string, Uint8Array>

export function numberRun(value: string) {
  return readTextValue(value)
    ?.flatMap((paragraph) => paragraph.runs)
    .find((run) => run.slideNumber !== undefined)
}

export function setNumber(value: string, slideNumber: SlideNumber): string {
  const text = readTextValue(value)
  if (text === null) return value
  return writeTextValue(
    text.map((paragraph) => ({
      ...paragraph,
      runs: paragraph.runs.map((run) => (run.slideNumber === undefined ? run : { ...run, slideNumber })),
    })),
  )
}

function defaultNumberBox({ width, height }: { readonly width: number; readonly height: number }) {
  return {
    x: Math.round(width * 0.8),
    y: Math.round(height * 0.9),
    cx: Math.round(width * 0.15),
    cy: Math.round(height * 0.08),
  }
}

function additions(
  parts: Parts,
  register: Register,
  index: number,
  source?: ElementId,
): readonly Extract<SlideCommand, { slide: "element-add" }>[] {
  const base = slideBase(parts, register)
  const display = exportedParts(parts, register)
  const shows = readShows(display)
  const shapes = readShapes(base)
  const numbered = new Set(
    shapes.flatMap((shape) => {
      const node = readElementId(`${shape.slide}.${shape.shape}`)
      if (node === undefined) return []
      const run = numberRun(shownValue(register, node, writeTextValue(shape.text)))
      return run === undefined ? [] : [shape.slide]
    }),
  )
  const reader = paintReader(display)
  const owner = source === undefined ? undefined : shapeOf(source)
  const sourcePart = owner === undefined ? undefined : shows.find((slide) => slide.slide === owner.slide)?.part
  const sourceElement =
    sourcePart === undefined ? undefined : reader.slide(sourcePart).elements.find((each) => each.shape === owner?.shape)
  const sourceShape =
    owner === undefined ? undefined : shapes.find((each) => each.slide === owner.slide && each.shape === owner.shape)
  const run =
    source === undefined || sourceShape === undefined
      ? undefined
      : numberRun(shownValue(register, source, writeTextValue(sourceShape.text)))
  if (source !== undefined && (run === undefined || sourceElement?.box == null)) return []
  const paragraph = sourceElement?.text?.paragraphs[0]
  const style = paragraph?.runs[0]
  const value = writeTextValue([
    {
      from: 0,
      align: paragraph?.align === "left" || paragraph?.align === "center" ? paragraph.align : "right",
      runs: [
        {
          ...run,
          from: -1,
          text: "1",
          slideNumber: run?.slideNumber ?? plainSlideNumber,
          ...(run?.color !== undefined || style?.color == null ? {} : { color: { rgb: style.color.hex } }),
          size: run?.size ?? (style === undefined ? 1800 : Math.round(style.size * 100)),
          ...(style === undefined
            ? {}
            : { ...(style.font === null ? {} : { font: style.font }), bold: style.bold, italic: style.italic }),
        },
      ],
    },
  ])
  const targets = source === undefined ? shows.slice(index, index + 1) : shows
  return targets.flatMap(({ slide, part, hidden }) => {
    const id = readSlideId(slide)
    if (id === undefined || hidden || numbered.has(slide)) return []
    const box =
      sourceElement?.box == null
        ? (slideNumberBox(base, part) ?? defaultNumberBox(reader.slide(part)))
        : boxOf(sourceElement.box)
    const node = nextElementId(register, id, freeShapeId(base, part))
    return [{ slide: "element-add", id, element: { node, box, kind: "shape", grouped: false, value } }]
  })
}

export async function addSlideNumbers(deck: Omit<InsertingDeck, "pictureTool" | "lane">, source?: ElementId) {
  const slot = deck.hold()
  try {
    await numbersAdded(deck, slot, source)
  } finally {
    slot.release()
  }
}

async function numbersAdded(deck: Omit<InsertingDeck, "pictureTool" | "lane">, slot: RecordHold, source?: ElementId) {
  const { id, shown } = deck
  const link = connect(memoryRemote())
  const opened = await link.openDeck(id)
  if (!opened.ok) return
  const parts = shown.shownParts.current
  const edits = additions(parts, opened.register, shown.current, source)
  const first = edits[0]
  if (first === undefined) return
  const file = fileSlides(parts, opened.register)
  const undoable = elementsUndoable(opened.register, file, edits)
  const kept = await link.enqueueSlides(id, file, edits)
  if (!kept.ok) {
    deck.settle("refused")
    return
  }
  if (undoable !== null) slot.record({ name: "slide-number", undoable })
  await shown.showEdited("kept")
  if (source === undefined) shown.setEntering({ id: first.element.node })
  deck.settle(await flushPending(connect, id))
}
