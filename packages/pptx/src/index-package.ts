import { slideTextStyles } from "./slide-text-styles.js"
import {
  bytesOf,
  elementId,
  limits,
  readSlideId,
  writeTableValue,
  writeTextValue,
  type DeckIndex,
  type IndexElement,
} from "@airdesign/document"
import { sectionStarts } from "./section-read.js"
import { templateStyles } from "./template-style.js"
import { slideTheme } from "./theme-swatches.js"
import { readNotes } from "./notes-body.js"
import { readArrival } from "./transition-read.js"
import { readShapes, readSlides, shapeKind } from "./read-shapes.js"
import { presentationPart } from "./package-address.js"
import { slideSkipped } from "./slide-show.js"
import { markupDocument } from "./element-span.js"
import { animatedShapeIds, freeShapeId } from "./shape-id.js"
import { readTable } from "./table-write.js"

type Shape = ReturnType<typeof readShapes>[number]

function tableValue(parts: ReadonlyMap<string, Uint8Array>, shape: Shape): string | null {
  try {
    const table = readTable(parts, shape.part, shape.shape)
    const value = table === null ? null : writeTableValue(table)
    return value !== null && bytesOf(value) <= limits.valueBytes ? value : null
  } catch {
    return null
  }
}

function indexedTransition(bytes: Uint8Array | undefined) {
  const arrival = readArrival(bytes)
  if (arrival.state === "kept") return { transition: "kept" as const }
  if ("none" in arrival.value && "click" in arrival.value.none.advance) return {}
  return { transition: arrival.value }
}

function valueOf(parts: ReadonlyMap<string, Uint8Array>, shape: Shape): string | null {
  if (shapeKind(shape) === "table") return tableValue(parts, shape)
  return shape.text.length === 0 ? null : writeTextValue(shape.text)
}

function slideSize(parts: ReadonlyMap<string, Uint8Array>): { readonly width: number; readonly height: number } | null {
  const bytes = parts.get(presentationPart)
  const element =
    bytes === undefined ? undefined : markupDocument(bytes).elements.find((each) => each.kind === "p:sldSz")
  const width = Number(element?.attributes.find((item) => item.name === "cx")?.value)
  const height = Number(element?.attributes.find((item) => item.name === "cy")?.value)
  return Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0
    ? { width, height }
    : null
}

export function indexPackage(
  parts: ReadonlyMap<string, Uint8Array>,
): Pick<DeckIndex, "slides" | "elements" | "templateStyles" | "sectionStarts"> {
  const size = slideSize(parts)
  const styleSources = new Map<string, string>()
  const slides = readSlides(parts).map(({ slide, part }, position) => {
    const bytes = parts.get(part)
    const elements = bytes === undefined ? [] : markupDocument(bytes).elements
    const templateStyle = slideTheme(parts, part)
    const styles = slideTextStyles(parts, part)
    const key = JSON.stringify(styles)
    const source = styleSources.get(key)
    styleSources.set(key, source ?? slide)
    return {
      id: slide,
      ...(templateStyle === null ? {} : { templateStyle }),
      ...(styles.length === 0 ? {} : { textStyles: source ?? styles }),
      position,
      ...(size === null ? {} : { size }),
      free: freeShapeId(parts, part),
      ...(slideSkipped(elements[0]) ? { skipped: true as const } : {}),
      animated: animatedShapeIds(elements),
      ...indexedTransition(bytes),
    }
  })
  const order = new Map(slides.map((slide) => [slide.id, slide.position]))
  const elements: IndexElement[] = readShapes(parts).map((shape) => ({
    node: elementId(`${shape.slide}.${shape.shape}`),
    kind: shapeKind(shape),
    value: valueOf(parts, shape),
    box: shape.box,
    grouped: shape.grouped === true,
    ...(shape.group === undefined ? {} : { group: elementId(`${shape.slide}.${shape.group}`) }),
    ...(shape.frame === undefined ? {} : { frame: shape.frame }),
  }))
  elements.push(
    ...readNotes(parts).map((notes) => ({
      node: elementId(`${notes.slide}.notes`),
      kind: "slide" as const,
      value: notes.text,
      box: null,
      grouped: false,
    })),
  )
  elements.sort((left, right) => {
    const slide = (order.get(left.node.split(".")[0] ?? "") ?? 0) - (order.get(right.node.split(".")[0] ?? "") ?? 0)
    return slide || (left.node < right.node ? -1 : left.node > right.node ? 1 : 0)
  })
  const starts = sectionStarts(parts).flatMap(({ start }) => {
    const id = readSlideId(slides[start]?.id)
    return id === undefined ? [] : [id]
  })
  return { slides, elements, sectionStarts: starts, templateStyles: templateStyles(parts) }
}
