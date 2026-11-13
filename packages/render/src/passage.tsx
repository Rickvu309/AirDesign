import { writeTextValue, type TextParagraph, type TextRun, type TextValue } from "@airdesign/document"
import { useLayoutEffect, useRef } from "react"
import type { ElementId } from "@airdesign/document"
import { formatTarget, type FormatEdit } from "./passage-format.js"
import { readFormat, writeFormat } from "./run-format-node.js"
import type { TextFormatting } from "./text-formatting.js"
import { useElement } from "./element-view.js"
import {
  cutValue,
  joinParagraph,
  lineBreak,
  paragraphText,
  splitParagraph,
  textValue,
  type Caret,
  replaceSelection,
} from "./paragraph-edit.js"
import type { PaintStore } from "./store.js"
import { holdsOnlyRuns, restyle, type TextLook } from "./text-look.js"

type ReadBox = { readonly value: TextValue; readonly units: readonly (readonly Node[])[] }
type Carets = { readonly start: Caret; readonly end: Caret }

function isText(node: Node): node is Text {
  return node.nodeType === node.TEXT_NODE
}

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === node.ELEMENT_NODE
}

function textNodes(node: Node): Text[] {
  if (isText(node)) return [node]
  return [...node.childNodes].flatMap(textNodes)
}

function collectRuns(nodes: NodeListOf<ChildNode> | readonly Node[], from: number, runs: TextRun[]): void {
  let loose = false
  for (const node of nodes) {
    if (isText(node)) {
      if (node.data === "") continue
      const last = runs.at(-1)
      if (loose && last !== undefined) runs[runs.length - 1] = { from: -1, text: last.text + node.data }
      else runs.push({ from: -1, text: node.data })
      loose = true
      continue
    }
    loose = false
    if (!isElement(node) || node.tagName === "BR") continue
    const source = node.dataset.run
    if (source === undefined) {
      collectRuns(node.childNodes, from, runs)
      continue
    }
    const [paragraph, run] = source.split(".").map(Number)
    runs.push({
      ...readFormat(node),
      from: paragraph === from && run !== undefined ? run : -1,
      text: node.textContent ?? "",
    })
  }
}

type ReadParagraph = {
  from: number
  align?: "left" | "center" | "right"
  bullet?: boolean
  runs: TextRun[]
}

function readParagraph(node: HTMLElement, from: number, runs: TextRun[]): ReadParagraph {
  let paragraph: ReadParagraph = { from, runs }
  const align = node.dataset.align
  if (align === "left" || align === "center" || align === "right") paragraph = { ...paragraph, align }
  if (node.dataset.bullet === "true" || node.dataset.bullet === "false") {
    paragraph = { ...paragraph, bullet: node.dataset.bullet === "true" }
  }
  return paragraph
}

function readBox(box: HTMLElement): ReadBox {
  const paragraphs: ReadParagraph[] = []
  const units: Node[][] = []
  let loose: Node[] | null = null
  for (const child of box.childNodes) {
    if (isElement(child) && child.dataset.paragraph !== undefined) {
      const from = Number(child.dataset.paragraph)
      const runs: TextRun[] = []
      collectRuns(child.childNodes, from, runs)
      paragraphs.push(readParagraph(child, from, runs))
      units.push([child])
      loose = null
      continue
    }
    if (loose === null) {
      loose = []
      units.push(loose)
      paragraphs.push({ from: paragraphs.at(-1)?.from ?? 0, runs: [] })
    }
    loose.push(child)
  }
  units.forEach((unit, index) => {
    const paragraph = paragraphs[index]
    if (
      paragraph !== undefined &&
      !(unit[0] !== undefined && isElement(unit[0]) && unit[0].dataset.paragraph !== undefined)
    ) {
      collectRuns(unit, paragraph.from, paragraph.runs)
    }
  })
  return { value: paragraphs, units }
}

function caretOf(box: HTMLElement, units: ReadBox["units"], node: Node, offset: number): Caret | null {
  const target = node === box ? (box.childNodes[offset] ?? box.lastChild) : node
  if (target === null) return { paragraph: 0, offset: 0 }
  const paragraph = units.findIndex((unit) => unit.some((part) => part === target || part.contains(target)))
  const first = units[paragraph]?.[0]
  if (first === undefined) return null
  const before = box.ownerDocument.createRange()
  before.setStartBefore(first)
  if (node === box) before.setEnd(box, offset)
  else before.setEnd(node, offset)
  return { paragraph, offset: before.toString().length }
}

function selectionCarets(box: HTMLElement, units: ReadBox["units"]): Carets | null {
  const selection = box.ownerDocument.getSelection()
  if (selection === null || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!box.contains(range.startContainer) || !box.contains(range.endContainer)) return null
  const start = caretOf(box, units, range.startContainer, range.startOffset)
  const end = caretOf(box, units, range.endContainer, range.endOffset)
  return start === null || end === null ? null : { start, end }
}

function pointAt(box: HTMLElement, caret: Caret): readonly [Node, number] {
  const paragraphs = box.children
  const paragraph = paragraphs[Math.min(caret.paragraph, paragraphs.length - 1)]
  if (paragraph === undefined) return [box, 0]
  let left = caret.offset
  let last: Text | null = null
  for (const node of textNodes(paragraph)) {
    if (left <= node.data.length) return [node, left]
    left -= node.data.length
    last = node
  }
  return last === null ? [paragraph, 0] : [last, last.data.length]
}

function paragraphNode(document: Document, paragraph: TextParagraph): HTMLElement {
  const block = document.createElement("div")
  block.dataset.paragraph = String(paragraph.from)
  if (paragraph.align !== undefined) block.dataset.align = paragraph.align
  if (paragraph.bullet !== undefined) block.dataset.bullet = String(paragraph.bullet)
  for (const run of paragraph.runs) {
    const span = document.createElement("span")
    span.dataset.run = `${paragraph.from}.${run.from}`
    writeFormat(span, run)
    if (run.text !== "") span.append(run.text)
    block.append(span)
  }
  if (paragraphText(paragraph) === "") block.append(document.createElement("br"))
  return block
}

function showValue(box: HTMLElement, value: TextValue, carets: Carets | null, look: TextLook | undefined): void {
  box.replaceChildren(...value.map((paragraph) => paragraphNode(box.ownerDocument, paragraph)))
  if (look !== undefined) restyle(box, look)
  if (carets === null || !box.contains(box.ownerDocument.activeElement)) return
  const selection = box.ownerDocument.getSelection()
  if (selection === null) return
  const kept = box.ownerDocument.createRange()
  kept.setStart(...pointAt(box, carets.start))
  kept.setEnd(...pointAt(box, carets.end))
  selection.removeAllRanges()
  selection.addRange(kept)
}

function sameCaret(carets: Carets): boolean {
  return carets.start.paragraph === carets.end.paragraph && carets.start.offset === carets.end.offset
}

export function refusedInput(event: InputEvent): boolean {
  return event.inputType.startsWith("format") || event.inputType.startsWith("history")
}

export const framedOutline = { outlineStyle: "solid", outlineWidth: 2, outlineColor: "transparent" } as const

export function Passage(props: {
  readonly store: PaintStore
  readonly id: ElementId
  readonly onEdit?: (value: string) => void
  readonly look?: TextLook | undefined
  readonly framed?: boolean
  readonly prompt?: string | undefined
  readonly formatting?: TextFormatting | undefined
}) {
  const { look } = props
  const record = useElement(props.store, props.id)
  const text = record === null ? "" : record.text
  const box = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  const reported = useRef(writeTextValue(textValue(text)))
  const pending = useRef<string[]>([])
  useLayoutEffect(() => {
    const shown = box.current
    if (shown === null || composing.current) return
    const echoed = pending.current.indexOf(text)
    if (echoed >= 0) {
      pending.current.splice(0, echoed + 1)
      return
    }
    pending.current.length = 0
    const value = textValue(text)
    reported.current = writeTextValue(value)
    const read = readBox(shown)
    if (writeTextValue(read.value) !== reported.current)
      showValue(shown, value, selectionCarets(shown, read.units), look)
  }, [record, text])
  useLayoutEffect(() => {
    const shown = box.current
    if (shown !== null && look !== undefined && !composing.current) restyle(shown, look)
  })
  function report(value: string) {
    if (value === reported.current) return
    reported.current = value
    if (props.onEdit === undefined) return
    pending.current.push(value)
    props.onEdit(value)
  }
  function edit(shown: HTMLElement, value: TextValue, caret: Caret, end: Caret = caret) {
    showValue(shown, value, { start: caret, end }, look)
    report(writeTextValue(value))
  }
  const formats = useRef<FormatEdit | null>(null)
  formats.current = {
    look,
    read(shown) {
      const read = readBox(shown)
      return { value: read.value, carets: selectionCarets(shown, read.units) }
    },
    edit,
  }
  const { formatting, id } = props
  useLayoutEffect(() => {
    const shown = box.current
    if (formatting === undefined || shown === null) return
    return formatTarget(formatting, id, shown, formats)
  }, [formatting, id])
  useLayoutEffect(() => {
    if (props.formatting !== undefined) props.formatting.changed()
  }, [props.formatting, text])
  function settle(shown: HTMLElement, read: ReadBox) {
    if (look === undefined) return
    if (holdsOnlyRuns(shown)) restyle(shown, look)
    else showValue(shown, read.value, selectionCarets(shown, read.units), look)
  }
  useLayoutEffect(() => {
    const shown = box.current
    if (shown === null) return
    function replace(event: InputEvent) {
      if (refusedInput(event)) {
        event.preventDefault()
        return
      }
      if (shown === null || composing.current || event.isComposing) return
      if (event.inputType !== "insertText" || event.data === null) return
      const read = readBox(shown)
      const at = selectionCarets(shown, read.units)
      if (at === null || sameCaret(at)) return
      event.preventDefault()
      const [value, caret] = replaceSelection(read.value, at.start, at.end, event.data.split(lineBreak))
      edit(shown, value, caret)
    }
    shown.addEventListener("beforeinput", replace)
    return () => {
      shown.removeEventListener("beforeinput", replace)
    }
  })
  return (
    <div
      ref={box}
      contentEditable={props.onEdit !== undefined}
      aria-placeholder={props.prompt}
      style={{ whiteSpace: "pre-wrap", ...(props.framed === true ? framedOutline : {}), ...look?.body }}
      onKeyDown={(event) => {
        if (composing.current || event.nativeEvent.isComposing) return
        const shown = event.currentTarget
        if (event.key === "Enter") {
          event.preventDefault()
          const read = readBox(shown)
          const at = selectionCarets(shown, read.units)
          if (at === null) return
          const kept = sameCaret(at) ? read.value : cutValue(read.value, at.start, at.end)
          edit(shown, splitParagraph(kept, at.start), { paragraph: at.start.paragraph + 1, offset: 0 })
          return
        }
        if (event.key !== "Backspace" && event.key !== "Delete") return
        const read = readBox(shown)
        const at = selectionCarets(shown, read.units)
        if (at === null) return
        if (!sameCaret(at)) {
          if (at.start.paragraph === at.end.paragraph) return
          event.preventDefault()
          edit(shown, cutValue(read.value, at.start, at.end), at.start)
          return
        }
        const paragraph = at.start.paragraph
        const before = read.value[paragraph - 1]
        if (event.key === "Backspace" && at.start.offset === 0 && before !== undefined) {
          event.preventDefault()
          edit(shown, joinParagraph(read.value, paragraph), {
            paragraph: paragraph - 1,
            offset: paragraphText(before).length,
          })
          return
        }
        const current = read.value[paragraph]
        const atEnd = current !== undefined && at.start.offset === paragraphText(current).length
        if (event.key === "Delete" && atEnd && paragraph + 1 < read.value.length) {
          event.preventDefault()
          edit(shown, joinParagraph(read.value, paragraph + 1), at.start)
        }
      }}
      onPaste={(event) => {
        event.preventDefault()
        const data = event.clipboardData.getData("text/plain")
        if (data === "") return
        const lines = data.split(lineBreak)
        const shown = event.currentTarget
        const read = readBox(shown)
        const at = selectionCarets(shown, read.units)
        if (at === null) return
        if (lines.length === 1 && sameCaret(at)) {
          shown.ownerDocument.execCommand("insertText", false, data)
          return
        }
        const [value, caret] = replaceSelection(read.value, at.start, at.end, lines)
        edit(shown, value, caret)
      }}
      onDrop={(event) => {
        event.preventDefault()
      }}
      onCompositionStart={() => {
        composing.current = true
        props.store.beginComposition(props.id)
      }}
      onCompositionEnd={(event) => {
        const read = readBox(event.currentTarget)
        settle(event.currentTarget, read)
        const value = writeTextValue(read.value)
        pending.current.push(value)
        props.store.endComposition(props.id, value)
        report(value)
        composing.current = false
      }}
      onInput={(event) => {
        const native = event.nativeEvent
        if (composing.current || (native instanceof InputEvent && native.isComposing)) return
        const read = readBox(event.currentTarget)
        settle(event.currentTarget, read)
        report(writeTextValue(read.value))
      }}
    />
  )
}
