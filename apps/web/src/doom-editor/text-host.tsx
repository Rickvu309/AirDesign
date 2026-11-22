import type { doom } from "@airdesign/document"
import { TextLines, gestureFor } from "@airdesign/render"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { offsetOfPlace, placeOfOffset, type Place } from "./text-caret"
import { graphemeAfter, graphemeBefore, wordAfter, wordBefore } from "./text-edit"
import type { TextSession } from "./use-text-session"

type Line = doom.ResolvedLine

function blankLine(text: doom.Text, theme: doom.Theme, width: number): Line {
  const style = theme.textStyles[text.style]
  return {
    start: 0,
    end: 0,
    x: text.padding?.l ?? 0,
    y: text.padding?.t ?? 0,
    w: Math.max(2, width),
    h: style.size * style.lineHeight,
    align: text.paras[0]?.align ?? "left",
    runs: [],
  }
}

function selectionOf(host: HTMLElement): { readonly anchor: number; readonly focus: number } | null {
  const selection = host.ownerDocument.defaultView?.getSelection()
  if (selection === null || selection === undefined || selection.anchorNode === null || selection.focusNode === null)
    return null
  const anchor = offsetOfPlace(host, { node: selection.anchorNode, at: selection.anchorOffset })
  const focus = offsetOfPlace(host, { node: selection.focusNode, at: selection.focusOffset })
  return anchor === null || focus === null ? null : { anchor, focus }
}

function showSelection(host: HTMLElement, anchor: number, focus: number) {
  const from = placeOfOffset(host, anchor)
  const to = placeOfOffset(host, focus)
  if (from === null || to === null) return
  host.ownerDocument.defaultView?.getSelection()?.setBaseAndExtent(from.node, from.at, to.node, to.at)
}

function placeAt(doc: Document, x: number, y: number): Place | null {
  const found = doc.caretPositionFromPoint?.(x, y)
  if (found !== null && found !== undefined) return { node: found.offsetNode, at: found.offset }
  const range = (
    doc as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
  ).caretRangeFromPoint?.(x, y)
  return range === null || range === undefined ? null : { node: range.startContainer, at: range.startOffset }
}

function lineBounds(host: HTMLElement, offset: number): { readonly start: number; readonly end: number } {
  const lines = [...host.querySelectorAll<HTMLElement>("[data-line]")]
  const line = lines.filter((each) => Number(each.dataset.start) <= offset).at(-1) ?? lines[0]
  return line === undefined
    ? { start: offset, end: offset }
    : { start: Number(line.dataset.start), end: Number(line.dataset.end) }
}

export function TextHost(props: {
  readonly node: doom.Resolved
  readonly theme: doom.Theme
  readonly api: TextSession
  readonly onLeave: () => void
}) {
  const { node, theme, api } = props
  const session = api.session!
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ api, session, onLeave: props.onLeave })
  const composing = useRef<{ readonly from: number; readonly to: number } | null>(null)
  const [fresh, setFresh] = useState(0)
  useEffect(() => {
    latest.current = { api, session, onLeave: props.onLeave }
  })

  useLayoutEffect(() => {
    const element = host.current
    if (element === null) return
    element.focus({ preventScroll: true })
    if (session.entry.kind === "point" && session.sync === 1) {
      const place = placeAt(element.ownerDocument, session.entry.x, session.entry.y)
      const offset = place === null ? null : offsetOfPlace(element, place)
      const at = offset ?? session.draft.chars.length
      latest.current.api.select(at, at)
      showSelection(element, at, at)
      return
    }
    showSelection(element, session.anchor, session.focus)
  }, [session.sync, fresh])

  useEffect(() => {
    const element = host.current
    if (element === null) return
    const doc = element.ownerDocument
    function listen() {
      const found = selectionOf(element!)
      if (found !== null && !composing.current) latest.current.api.select(found.anchor, found.focus)
    }
    function before(event: InputEvent) {
      if (composing.current !== null || event.inputType === "insertCompositionText") return
      event.preventDefault()
      const { api: current, session: now } = latest.current
      const at = selectionOf(element!) ?? { anchor: now.anchor, focus: now.focus }
      const from = Math.min(at.anchor, at.focus)
      const to = Math.max(at.anchor, at.focus)
      const chars = now.draft.chars
      const collapsed = from === to
      const type = event.inputType
      if (type === "insertText" || type === "insertReplacementText") {
        const data = event.data ?? event.dataTransfer?.getData("text/plain") ?? ""
        if (data !== "") current.replace(from, to, data)
      } else if (type === "insertParagraph" || type === "insertLineBreak") {
        const para = now.draft.paras[chars.slice(0, from).split("\n").length - 1]
        const lineStart = chars.lastIndexOf("\n", from - 1) + 1
        const lineEnd = chars.indexOf("\n", from) === -1 ? chars.length : chars.indexOf("\n", from)
        if (collapsed && para?.list !== undefined && lineStart === lineEnd) current.list(para.list)
        else current.replace(from, to, "\n")
      } else if (type === "deleteContentBackward") {
        current.replace(collapsed ? graphemeBefore(chars, from) : from, to, "")
      } else if (type === "deleteContentForward") {
        current.replace(from, collapsed ? graphemeAfter(chars, to) : to, "")
      } else if (type === "deleteWordBackward") {
        current.replace(collapsed ? wordBefore(chars, from) : from, to, "")
      } else if (type === "deleteWordForward") {
        current.replace(from, collapsed ? wordAfter(chars, to) : to, "")
      } else if (type === "deleteSoftLineBackward" || type === "deleteHardLineBackward") {
        current.replace(collapsed ? lineBounds(element!, from).start : from, to, "")
      } else if (type === "deleteSoftLineForward" || type === "deleteHardLineForward") {
        current.replace(from, collapsed ? lineBounds(element!, to).end : to, "")
      } else if (type === "deleteByCut" || type === "deleteByDrag") {
        current.replace(from, to, "")
      } else if (type === "insertFromPaste" || type === "insertFromDrop") {
        const data = (event.dataTransfer?.getData("text/plain") ?? "").replace(/\r\n?/g, "\n")
        if (data !== "") current.replace(from, to, data)
      } else if (type === "historyUndo" || type === "historyRedo") {
        current.step(type === "historyUndo" ? "undo" : "redo")
      }
    }
    doc.addEventListener("selectionchange", listen)
    element.addEventListener("beforeinput", before)
    return () => {
      doc.removeEventListener("selectionchange", listen)
      element.removeEventListener("beforeinput", before)
    }
  }, [fresh])

  function keys(event: React.KeyboardEvent) {
    const gesture = gestureFor(event.nativeEvent, "text") ?? gestureFor(event.nativeEvent, "editor")
    const { api: current } = latest.current
    const handled = () => event.preventDefault()
    const found = host.current === null ? null : selectionOf(host.current)
    if (found !== null) current.select(found.anchor, found.focus)
    if (gesture === "deselect") {
      handled()
      latest.current.onLeave()
    } else if (gesture === "bold" || gesture === "italic" || gesture === "underline" || gesture === "strike") {
      handled()
      current.mark(gesture)
    } else if (
      gesture === "text-left" ||
      gesture === "text-center" ||
      gesture === "text-right" ||
      gesture === "text-justify"
    ) {
      handled()
      current.align(gesture.slice("text-".length) as "left")
    } else if (gesture === "bullets" || gesture === "numbers") {
      handled()
      current.list(gesture === "bullets" ? "bullet" : "number")
    } else if (gesture === "undo" || gesture === "redo") {
      handled()
      current.step(gesture)
    } else if (gesture === "list-indent" || gesture === "list-outdent") {
      handled()
      current.indent(gesture === "list-indent" ? 1 : -1)
    }
  }

  function copy(event: React.ClipboardEvent, cut: boolean) {
    const { api: current, session: now } = latest.current
    const from = Math.min(now.anchor, now.focus)
    const to = Math.max(now.anchor, now.focus)
    event.preventDefault()
    if (from === to) return
    event.clipboardData.setData("text/plain", now.draft.chars.slice(from, to))
    if (cut) current.replace(from, to, "")
  }

  const lines = node.text?.lines ?? [blankLine(session.draft, theme, node.box.w)]
  return (
    <div
      key={fresh}
      ref={host}
      data-text-editor=""
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "auto",
        outline: "none",
        cursor: "text",
        userSelect: "text",
        minWidth: 2,
      }}
      onKeyDown={keys}
      onCopy={(event) => copy(event, false)}
      onCut={(event) => copy(event, true)}
      onPaste={(event) => {
        event.preventDefault()
        const { api: current, session: now } = latest.current
        const data = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n")
        if (data !== "") current.replace(Math.min(now.anchor, now.focus), Math.max(now.anchor, now.focus), data)
      }}
      onCompositionStart={() => {
        const found = host.current === null ? null : selectionOf(host.current)
        const now = latest.current.session
        const at = found ?? { anchor: now.anchor, focus: now.focus }
        composing.current = { from: Math.min(at.anchor, at.focus), to: Math.max(at.anchor, at.focus) }
      }}
      onCompositionEnd={(event) => {
        const range = composing.current
        composing.current = null
        if (range === null) return
        latest.current.api.replace(range.from, range.to, event.data)
        setFresh((value) => value + 1)
      }}
    >
      <TextLines lines={lines} editing />
    </div>
  )
}
