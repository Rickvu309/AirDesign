import { owns, shapeById } from "./shape-tree.js"
import type { TextValue } from "@airdesign/document"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { readShapes } from "./read-shapes.js"
import { xmlText } from "./shape-write.js"
import { applyRoute, type SlideRoute } from "./slide-route.js"
import { shownText } from "./text-value-route.js"

const slidePart = "ppt/slides/slide1.xml"

type TextSpan = {
  readonly start: number
  readonly end: number
}

function textInteriors(bytes: Uint8Array, shapeId: string): readonly TextSpan[] | null {
  const document = markupDocument(bytes)
  if (!document.wellFormed) return null
  let shape: MarkupElement
  try {
    shape = shapeById(document.elements, shapeId)
  } catch {
    return []
  }
  const spans: TextSpan[] = []
  for (const element of document.elements) {
    if (element.kind !== "a:t" || element.selfClosing || element.closeStart < element.openEnd) continue
    if (!owns(document.elements, element.index, shape)) continue
    spans.push({ start: element.openEnd, end: element.closeStart })
  }
  return spans
}

function sameOutside(
  left: Uint8Array,
  right: Uint8Array,
  leftSpans: readonly TextSpan[],
  rightSpans: readonly TextSpan[],
): boolean {
  let leftIndex = 0
  let rightIndex = 0
  let leftSpan = 0
  let rightSpan = 0
  while (leftIndex < left.length || rightIndex < right.length) {
    const skipLeft = leftSpans[leftSpan]
    if (skipLeft !== undefined && leftIndex === skipLeft.start) {
      leftIndex = skipLeft.end
      leftSpan += 1
      continue
    }
    const skipRight = rightSpans[rightSpan]
    if (skipRight !== undefined && rightIndex === skipRight.start) {
      rightIndex = skipRight.end
      rightSpan += 1
      continue
    }
    if (leftIndex >= left.length || rightIndex >= right.length) return false
    if (left[leftIndex] !== right[rightIndex]) return false
    leftIndex += 1
    rightIndex += 1
  }
  return leftSpan === leftSpans.length && rightSpan === rightSpans.length
}

function packageFailures(
  original: ReadonlyMap<string, Uint8Array>,
  exported: ReadonlyMap<string, Uint8Array>,
  slide: string,
): string[] {
  const failures: string[] = []
  for (const name of original.keys()) {
    if (!exported.has(name)) failures.push(`missing part ${name}`)
  }
  for (const name of exported.keys()) {
    if (!original.has(name)) failures.push(`extra part ${name}`)
  }
  if (failures.length === 0 && [...original.keys()].join("\n") !== [...exported.keys()].join("\n")) {
    failures.push("part order")
  }
  for (const [name, before] of original) {
    if (name === slide) continue
    const after = exported.get(name)
    if (after === undefined) continue
    if (!sameBytes(before, after)) failures.push(`part ${name}`)
  }
  return failures
}

export function browserExportFailures(
  clean: ReadonlyMap<string, Uint8Array>,
  exported: ReadonlyMap<string, Uint8Array>,
  shape: string,
  text: string,
): readonly string[] {
  const failures = packageFailures(clean, exported, slidePart)
  const beforeSlide = clean.get(slidePart)
  const afterSlide = exported.get(slidePart)
  if (beforeSlide === undefined || afterSlide === undefined) return failures
  const found = readShapes(exported).filter((row) => row.part === slidePart && row.shape === shape)
  const row = found.length === 1 ? found[0] : undefined
  if (row === undefined) failures.push(`shape ${shape}`)
  else if (shownText(row.text) !== text) failures.push(`shape ${shape} text ${shownText(row.text)}`)
  const beforeSpans = textInteriors(beforeSlide, shape)
  const afterSpans = textInteriors(afterSlide, shape)
  const written = afterSpans?.length === 1 ? afterSpans[0] : undefined
  const exact =
    written !== undefined && sameBytes(afterSlide.subarray(written.start, written.end), encodeUtf8(xmlText(text)))
  if (row !== undefined && shownText(row.text) === text && !exact) failures.push(`shape ${shape} text bytes`)
  if (beforeSpans === null || afterSpans === null || !sameOutside(beforeSlide, afterSlide, beforeSpans, afterSpans)) {
    failures.push(`${slidePart} outside shape ${shape} text`)
  }
  return failures
}

export type ParagraphExpectation = {
  readonly part: string
  readonly shape: string
  readonly value: TextValue
}

export function paragraphExportFailures(
  original: ReadonlyMap<string, Uint8Array>,
  exported: ReadonlyMap<string, Uint8Array>,
  expected: ParagraphExpectation,
): readonly string[] {
  const { part, shape, value } = expected
  const failures = packageFailures(original, exported, part)
  const afterSlide = exported.get(part)
  if (original.get(part) === undefined || afterSlide === undefined) return failures
  const found = readShapes(exported).filter((row) => row.part === part && row.shape === shape)
  const row = found.length === 1 ? found[0] : undefined
  if (row === undefined) failures.push(`shape ${shape}`)
  else {
    const shown = JSON.stringify(row.text.map((paragraph) => paragraph.runs.map((run) => run.text)))
    const wanted = JSON.stringify(value.map((paragraph) => paragraph.runs.map((run) => run.text)))
    if (shown !== wanted) failures.push(`shape ${shape} paragraphs ${shown}`)
  }
  const routed = applyRoute(original, { name: "text", part, shape, value }).get(part)
  if (routed === undefined || !sameBytes(routed, afterSlide)) failures.push(`${part} bytes`)
  return failures
}

export function routeExportFailures(
  original: ReadonlyMap<string, Uint8Array>,
  exported: ReadonlyMap<string, Uint8Array>,
  routes: readonly Exclude<SlideRoute, { readonly name: "add" }>[],
): readonly string[] {
  const part = routes[0]?.part
  if (part === undefined || routes.some((route) => route.part !== part)) throw new Error("route part")
  const failures = packageFailures(original, exported, part)
  const afterSlide = exported.get(part)
  if (original.get(part) === undefined || afterSlide === undefined) return failures
  const routed = routes.reduce<ReadonlyMap<string, Uint8Array>>((parts, route) => applyRoute(parts, route), original)
  const written = routed.get(part)
  if (written === undefined || !sameBytes(written, afterSlide)) failures.push(`${part} bytes`)
  return failures
}
