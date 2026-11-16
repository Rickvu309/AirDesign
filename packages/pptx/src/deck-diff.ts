import { contentSpans, decodedXmlText, markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, sameBytes } from "./package-bytes.js"
import type { PartTouch } from "./slide-touch.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type XmlChange = { readonly at: string; readonly op: "-" | "+"; readonly text: string }

export type PartDiff = {
  readonly part: string
  readonly kind: "xml" | "binary"
  readonly before: number
  readonly after: number
  readonly lines: readonly XmlChange[]
  readonly more: number
}

export type DeckDiff = PartTouch & {
  readonly same: number
  readonly orderMoved: boolean
}

type Line = { readonly at: string; readonly text: string }

const searchReach = 2000

export function deckDiff(before: Parts, after: Parts): DeckDiff {
  const changed: string[] = []
  const removed: string[] = []
  let same = 0
  for (const [name, left] of before) {
    const right = after.get(name)
    if (right === undefined) removed.push(name)
    else if (sameBytes(left, right)) same += 1
    else changed.push(name)
  }
  const added = [...after.keys()].filter((name) => !before.has(name))
  const kept = (parts: Parts) => [...parts.keys()].filter((name) => before.has(name) && after.has(name))
  const orderMoved = kept(before).join("\n") !== kept(after).join("\n")
  return { changed, added, removed, same, orderMoved }
}

export function partDiff(part: string, before: Uint8Array, after: Uint8Array, limit = 200): PartDiff {
  const sizes = { part, before: before.length, after: after.length }
  const left = markupLines(part, before)
  const right = markupLines(part, after)
  if (left === null || right === null) return { ...sizes, kind: "binary", lines: [], more: 0 }
  const lines = lineChanges(left, right)
  return { ...sizes, kind: "xml", lines: lines.slice(0, limit), more: Math.max(0, lines.length - limit) }
}

function markupLines(part: string, bytes: Uint8Array): readonly Line[] | null {
  if (!/\.(xml|rels|vml)$/i.test(part)) return null
  const document = markupDocument(bytes)
  if (!document.wellFormed) return null
  const { elements } = document
  const labels = elementLabels(elements)
  const paths: string[] = []
  const lines: Line[] = []
  for (const element of elements) {
    const at = element.parent < 0 ? labels[element.index] : `${paths[element.parent]}/${labels[element.index]}`
    paths.push(at ?? element.kind)
    lines.push({ at: paths[element.index] ?? "", text: openTag(element) })
    const text = leafText(bytes, element, elements)
    if (text !== null) lines.push({ at: paths[element.index] ?? "", text })
  }
  return lines
}

function elementLabels(elements: readonly MarkupElement[]): readonly string[] {
  const ids = new Map<number, string>()
  for (const element of elements) {
    if (!element.kind.endsWith(":cNvPr") || element.id === null) continue
    const holder = elements[element.parent]?.parent ?? -1
    if (holder >= 0 && !ids.has(holder)) ids.set(holder, element.id)
  }
  const counts = new Map<string, number>()
  const key = (element: MarkupElement) => `${element.parent} ${element.kind}`
  for (const element of elements) counts.set(key(element), (counts.get(key(element)) ?? 0) + 1)
  const seen = new Map<string, number>()
  return elements.map((element) => {
    const id = ids.get(element.index)
    if (id !== undefined) return `${element.kind}[id=${id}]`
    const position = (seen.get(key(element)) ?? 0) + 1
    seen.set(key(element), position)
    return (counts.get(key(element)) ?? 0) > 1 ? `${element.kind}[${position}]` : element.kind
  })
}

function openTag(element: MarkupElement): string {
  const attributes = element.attributes.map((attribute) => ` ${attribute.name}="${attribute.value}"`).join("")
  return `<${element.kind}${attributes}>`
}

function leafText(bytes: Uint8Array, element: MarkupElement, elements: readonly MarkupElement[]): string | null {
  if (element.selfClosing || elements[element.index + 1]?.parent === element.index) return null
  const text = contentSpans(bytes, element)
    .map((span) => {
      const raw = decodeUtf8(bytes.subarray(span.start, span.end))
      return span.literal ? raw : decodedXmlText(raw)
    })
    .join("")
  return text.trim() === "" ? null : text
}

function lineChanges(left: readonly Line[], right: readonly Line[]): readonly XmlChange[] {
  const keys = (lines: readonly Line[]) => lines.map((line) => `${line.at.replace(/\[\d+\]/g, "")}\n${line.text}`)
  let start = 0
  let leftEnd = left.length
  let rightEnd = right.length
  const leftKeys = keys(left)
  const rightKeys = keys(right)
  while (start < leftEnd && start < rightEnd && leftKeys[start] === rightKeys[start]) start += 1
  while (leftEnd > start && rightEnd > start && leftKeys[leftEnd - 1] === rightKeys[rightEnd - 1]) {
    leftEnd -= 1
    rightEnd -= 1
  }
  const script = editScript(leftKeys.slice(start, leftEnd), rightKeys.slice(start, rightEnd))
  return script.map(({ op, index }) => {
    const line = (op === "-" ? left : right)[start + index]
    return { at: line?.at ?? "", op, text: line?.text ?? "" }
  })
}

type Edit = { readonly op: "-" | "+"; readonly index: number }

function editScript(left: readonly string[], right: readonly string[]): readonly Edit[] {
  const width = left.length + right.length
  const reach = Math.min(width, searchReach)
  const furthest = new Int32Array(2 * width + 3)
  const offset = width + 1
  const rounds: Int32Array[] = []
  for (let round = 0; round <= reach; round += 1) {
    for (let diagonal = -round; diagonal <= round; diagonal += 2) {
      const down =
        diagonal === -round ||
        (diagonal !== round && (furthest[offset + diagonal - 1] ?? 0) < (furthest[offset + diagonal + 1] ?? 0))
      let x = down ? (furthest[offset + diagonal + 1] ?? 0) : (furthest[offset + diagonal - 1] ?? 0) + 1
      let y = x - diagonal
      while (x < left.length && y < right.length && left[x] === right[y]) {
        x += 1
        y += 1
      }
      furthest[offset + diagonal] = x
      if (x >= left.length && y >= right.length) {
        rounds.push(furthest.slice(offset - round, offset + round + 1))
        return traced(rounds, left.length, right.length)
      }
    }
    rounds.push(furthest.slice(offset - round, offset + round + 1))
  }
  return [
    ...left.map((_, index) => ({ op: "-" as const, index })),
    ...right.map((_, index) => ({ op: "+" as const, index })),
  ]
}

function traced(rounds: readonly Int32Array[], leftLength: number, rightLength: number): readonly Edit[] {
  const edits: Edit[] = []
  let x = leftLength
  let y = rightLength
  for (let round = rounds.length - 1; round > 0; round -= 1) {
    const previous = rounds[round - 1] ?? new Int32Array()
    const at = (diagonal: number) => previous[diagonal + round - 1] ?? 0
    const diagonal = x - y
    const down = diagonal === -round || (diagonal !== round && at(diagonal - 1) < at(diagonal + 1))
    const fromDiagonal = down ? diagonal + 1 : diagonal - 1
    const fromX = at(fromDiagonal)
    const fromY = fromX - fromDiagonal
    edits.push(down ? { op: "+", index: fromY } : { op: "-", index: fromX })
    x = fromX
    y = fromY
  }
  return edits.reverse()
}
