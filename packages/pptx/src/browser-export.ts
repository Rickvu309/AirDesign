import { markupDocument, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { readShapes } from "./read-shapes.js"
import { xmlText } from "./shape-write.js"
import { shownText } from "./text-value-route.js"

const slidePart = "ppt/slides/slide1.xml"
const shapeKinds = new Set(["p:sp", "p:pic", "p:graphicFrame", "p:cxnSp", "p:grpSp"])

type TextSpan = {
  readonly start: number
  readonly end: number
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function owns(elements: readonly MarkupElement[], index: number, shape: MarkupElement): boolean {
  let parent = elements[index]?.parent ?? -1
  while (parent >= 0) {
    const ancestor = elements[parent]
    if (ancestor === undefined) return false
    if (shapeKinds.has(ancestor.kind)) return ancestor.index === shape.index
    parent = ancestor.parent
  }
  return false
}

function shapeById(elements: readonly MarkupElement[], id: string): MarkupElement | null {
  for (const mark of elements) {
    if (mark.kind !== "p:cNvPr" || mark.id !== id) continue
    let parent = mark.parent
    while (parent >= 0) {
      const ancestor = elements[parent]
      if (ancestor === undefined) break
      if (shapeKinds.has(ancestor.kind)) return ancestor
      parent = ancestor.parent
    }
  }
  return null
}

function textInteriors(bytes: Uint8Array, shapeId: string): readonly TextSpan[] | null {
  const document = markupDocument(bytes)
  if (!document.wellFormed) return null
  const shape = shapeById(document.elements, shapeId)
  if (shape === null) return []
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
  readonly paragraphs: readonly (readonly string[])[]
  readonly kept: number
  readonly bold: readonly string[]
}

type TextBody = {
  readonly span: TextSpan
  readonly paragraphs: readonly MarkupElement[]
  readonly runs: readonly MarkupElement[]
  readonly elements: readonly MarkupElement[]
}

function textBody(bytes: Uint8Array, shapeId: string): TextBody | null {
  const document = markupDocument(bytes)
  if (!document.wellFormed) return null
  const shape = shapeById(document.elements, shapeId)
  if (shape === null) return null
  const body = document.elements.find(
    (element) => element.kind === "p:txBody" && element.parent === shape.index && !element.selfClosing,
  )
  if (body === undefined) return null
  const paragraphs = document.elements.filter((element) => element.kind === "a:p" && element.parent === body.index)
  const paragraphIndexes = new Set(paragraphs.map((element) => element.index))
  const runs = document.elements.filter((element) => element.kind === "a:r" && paragraphIndexes.has(element.parent))
  return { span: { start: body.openEnd, end: body.closeStart }, paragraphs, runs, elements: document.elements }
}

function boldRuns(bytes: Uint8Array, body: TextBody, text: string): readonly boolean[] {
  const wanted = encodeUtf8(xmlText(text))
  const found: boolean[] = []
  for (const run of body.runs) {
    const holder = body.elements.find((element) => element.kind === "a:t" && element.parent === run.index)
    if (holder === undefined || holder.selfClosing) continue
    if (!sameBytes(bytes.subarray(holder.openEnd, holder.closeStart), wanted)) continue
    const format = body.elements.find((element) => element.kind === "a:rPr" && element.parent === run.index)
    found.push(format?.attributes.some((item) => item.name === "b" && item.value === "1") === true)
  }
  return found
}

export function paragraphExportFailures(
  original: ReadonlyMap<string, Uint8Array>,
  exported: ReadonlyMap<string, Uint8Array>,
  expected: ParagraphExpectation,
): readonly string[] {
  const { part, shape } = expected
  const failures = packageFailures(original, exported, part)
  const beforeSlide = original.get(part)
  const afterSlide = exported.get(part)
  if (beforeSlide === undefined || afterSlide === undefined) return failures
  const found = readShapes(exported).filter((row) => row.part === part && row.shape === shape)
  const row = found.length === 1 ? found[0] : undefined
  if (row === undefined) failures.push(`shape ${shape}`)
  else {
    const shown = row.text.map((paragraph) => paragraph.runs.map((run) => run.text))
    if (JSON.stringify(shown) !== JSON.stringify(expected.paragraphs)) {
      failures.push(`shape ${shape} paragraphs ${JSON.stringify(shown)}`)
    }
  }
  const before = textBody(beforeSlide, shape)
  const after = textBody(afterSlide, shape)
  if (before === null || after === null) {
    failures.push(`shape ${shape} text body`)
    return failures
  }
  if (!sameOutside(beforeSlide, afterSlide, [before.span], [after.span])) {
    failures.push(`${part} outside shape ${shape} text`)
  }
  for (let index = 0; index < expected.kept; index += 1) {
    const was = before.paragraphs[index]
    const now = after.paragraphs[index]
    if (was === undefined || now === undefined) failures.push(`shape ${shape} paragraph ${index}`)
    else if (!sameBytes(beforeSlide.subarray(was.start, was.end), afterSlide.subarray(now.start, now.end))) {
      failures.push(`shape ${shape} paragraph ${index} bytes`)
    }
  }
  for (const text of expected.bold) {
    const states = boldRuns(afterSlide, after, text)
    if (states.length !== 1 || states[0] !== true) failures.push(`shape ${shape} bold ${text}`)
  }
  return failures
}
