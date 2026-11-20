import {
  alignNames,
  lastListLevel,
  levelRange,
  spacingNames,
  writeTextValue,
  type LevelStep,
  type ParagraphAlign,
  type ParagraphSpacing,
  type TextParagraph,
  type TextList,
  type TextRun,
  type TextValue,
} from "@airdesign/document"
import { useLayoutEffect, useRef, useState } from "react"
import type { ElementId } from "@airdesign/document"
import { formatTarget, type FormatEdit } from "./passage-format.js"
import { gestureFor } from "./gestures.js"
import { readFormat, writeFormat } from "./run-format-node.js"
import type { TextFormatting } from "./text-formatting.js"
import { useTextReach } from "./text-reach.js"
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
      if (last !== undefined && (loose || last.text === ""))
        runs[runs.length - 1] = { ...last, text: last.text + node.data }
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
  align?: ParagraphAlign
  list?: TextList
  level?: number
  runs: TextRun[]
} & ParagraphSpacing

function readParagraph(node: HTMLElement, from: number, runs: TextRun[]): ReadParagraph {
  let paragraph: ReadParagraph = { from, runs }
  const align = alignNames.find((name) => name === node.dataset.align)
  if (align !== undefined) paragraph = { ...paragraph, align }
  const list = node.dataset.list
  if (list === "none" || list === "bullets" || list === "numbers") paragraph = { ...paragraph, list }
  const level = node.dataset.level
  if (level !== undefined && /^\d$/.test(level) && Number(level) <= lastListLevel)
    paragraph = { ...paragraph, level: Number(level) }
  for (const name of spacingNames) {
    const kept = node.dataset[name]
    if (kept !== undefined && /^\d+$/.test(kept)) paragraph = { ...paragraph, [name]: Number(kept) }
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
  if (last !== null) return [last, last.data.length]
  const run = paragraph.querySelector("[data-run]")
  return run === null ? [paragraph, 0] : [run, 0]
}

function paragraphNode(document: Document, paragraph: TextParagraph, readonly: boolean): HTMLElement {
  const block = document.createElement("div")
  block.dataset.paragraph = String(paragraph.from)
  if (paragraph.align !== undefined) block.dataset.align = paragraph.align
  if (paragraph.list !== undefined) block.dataset.list = paragraph.list
  if (paragraph.level !== undefined) block.dataset.level = String(paragraph.level)
  for (const name of spacingNames) {
    const kept = paragraph[name]
    if (kept !== undefined) block.dataset[name] = String(kept)
  }
  for (const run of paragraph.runs) {
    const link = run.link
    const span =
      readonly && link !== undefined && link.kind !== "none" && link.kind !== "unsupported"
        ? document.createElement("a")
        : document.createElement("span")
    if (
      span instanceof document.defaultView!.HTMLAnchorElement &&
      link !== undefined &&
      link.kind !== "none" &&
      link.kind !== "unsupported"
    ) {
      span.addEventListener("click", (event) => {
        if (span.closest("[data-link-navigation]") === null) event.preventDefault()
      })
      span.dataset.textLink = ""
      span.href = link.kind === "url" ? link.url : `#slide-${link.slide}`
      span.target = link.kind === "url" ? "_blank" : ""
      span.rel = "noopener noreferrer"
      span.style.pointerEvents = "auto"
      span.style.position = "relative"
      span.style.zIndex = "1"
    }
    span.dataset.run = `${paragraph.from}.${run.from}`
    writeFormat(span, run)
    if (run.text !== "") span.append(run.text)
    else if (paragraph.runs.every((each) => each.text === "") && block.children.length === 0)
      span.append(document.createElement("br"))
    block.append(span)
  }
  if (paragraph.runs.length === 0) block.append(document.createElement("br"))
  return block
}

function showValue(box: HTMLElement, value: TextValue, carets: Carets | null, look: TextLook | undefined): void {
  box.replaceChildren(
    ...value.map((paragraph) =>
      paragraphNode(box.ownerDocument, paragraph, box.getAttribute("contenteditable") === "false"),
    ),
  )
  if (look !== undefined) restyle(box, look)
  if (carets === null || !box.contains(box.ownerDocument.activeElement)) return
  placeCarets(box, carets)
}

function placeCarets(box: HTMLElement, carets: Carets): void {
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

export type TextEditKind = "text" | "format"

export const framedOutline = { outlineStyle: "solid", outlineWidth: 2, outlineColor: "transparent" } as const

export function Passage(props: {
  readonly store: PaintStore
  readonly id: ElementId
  readonly onEdit?: (value: string, kind: TextEditKind) => void
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
  const reach = useTextReach(box, {
    read: (shown) => selectionCarets(shown, readBox(shown).units),
    place: placeCarets,
  })
  const [opened] = useState(() => writeTextValue(textValue(text)))
  const reported = useRef(opened)
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
  }, [look])
  function report(value: string, kind: TextEditKind = "text") {
    if (value === reported.current) return
    reported.current = value
    if (props.onEdit === undefined) return
    pending.current.push(value)
    props.onEdit(value, kind)
  }
  function edit(shown: HTMLElement, value: TextValue, caret: Caret, end: Caret = caret, kind: TextEditKind = "text") {
    showValue(shown, value, { start: caret, end }, look)
    report(writeTextValue(value), kind)
  }
  function leveled(value: TextValue, at: { readonly start: Caret; readonly end: Caret }, step: LevelStep) {
    return levelRange(
      value,
      at,
      step,
      (from) => look?.fileLevel(from) ?? 0,
      (from) => look?.fileList(from) ?? "none",
    )
  }
  const formats = useRef<FormatEdit | null>(null)
  formats.current = {
    look,
    read(shown) {
      const read = readBox(shown)
      return { value: read.value, carets: selectionCarets(shown, read.units) }
    },
    edit: (shown, value, start, end) => edit(shown, value, start, end, "format"),
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
      data-text-body=""
      contentEditable={props.onEdit !== undefined}
      aria-placeholder={props.prompt}
      style={{ whiteSpace: "pre-wrap", ...(props.framed === true ? framedOutline : {}), ...look?.body }}
      {...reach.handlers}
      onKeyDown={(event) => {
        if (composing.current || event.nativeEvent.isComposing) return
        const shown = event.currentTarget
        const gesture = gestureFor(event, "text")
        if (gesture === "list-indent" || gesture === "list-outdent") {
          if (reach.passesTab()) return
          event.preventDefault()
          const read = readBox(shown)
          const at = selectionCarets(shown, read.units)
          const next = at === null ? null : leveled(read.value, at, gesture === "list-indent" ? 1 : -1)
          if (at === null || next === null) return
          edit(shown, next, at.start, at.end, "format")
          return
        }
        if (event.key === "Enter") {
          event.preventDefault()
          const read = readBox(shown)
          const at = selectionCarets(shown, read.units)
          if (at === null) return
          const current = read.value[at.start.paragraph]
          const outdented =
            sameCaret(at) && current !== undefined && paragraphText(current) === "" ? leveled(read.value, at, -1) : null
          if (outdented !== null && writeTextValue(outdented) !== writeTextValue(read.value)) {
            edit(shown, outdented, at.start, at.end, "format")
            return
          }
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
        reach.typed()
        const native = event.nativeEvent
        if (composing.current || (native instanceof InputEvent && native.isComposing)) return
        const read = readBox(event.currentTarget)
        settle(event.currentTarget, read)
        report(writeTextValue(read.value))
      }}
    />
  )
}
