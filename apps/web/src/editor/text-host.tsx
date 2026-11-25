import * as doom from "@airdesign/doom"
import { TextLines } from "@airdesign/render"
import { gestureFor } from "@/lib/gestures"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { blankLine } from "./text-blank-line"
import { offsetOfPlace, placeOfOffset, type Place } from "./text-caret"
import { readTextClipboard, writeTextClipboard } from "./text-clipboard"
import { graphemeAfter, graphemeBefore, sliceText, wordAfter, wordBefore } from "./text-edit"
import type { TextSession } from "./use-text-session"
import { composing } from "@/lib/composing"

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
  readonly deck: string
  readonly slides: readonly doom.NodeId[]
  readonly node: doom.Resolved
  readonly theme: doom.Theme
  readonly api: TextSession
  readonly onLeave: () => void
}) {
  const { deck, slides, node, theme, api } = props
  const session = api.session!
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ api, session, deck, slides, onLeave: props.onLeave })
  const marked = useRef<{ readonly from: number; readonly to: number } | null>(null)
  const [fresh, setFresh] = useState(0)
  const painted = useRef<{
    readonly draft: doom.Text
    readonly lines: readonly doom.ResolvedLine[]
    readonly followFormatting: boolean
  } | null>(null)
  const previous = painted.current
  const sameDraft = session.draft === previous?.draft
  const followFormatting = sameDraft ? previous.followFormatting : session.draft.chars === previous?.draft.chars
  const lines =
    previous !== null &&
    (marked.current !== null || (sameDraft && !followFormatting && !previous.lines.some((line) => line.pending)))
      ? previous.lines
      : (node.text?.sourceLines ?? node.text?.lines ?? [blankLine(session.draft, theme, node)])
  const focused = useRef<{ readonly element: HTMLDivElement; readonly sync: number } | null>(null)
  useEffect(() => {
    latest.current = { api, session, deck, slides, onLeave: props.onLeave }
  })

  useLayoutEffect(() => {
    const element = host.current
    if (element === null || marked.current !== null) return
    painted.current = { draft: session.draft, lines, followFormatting }
    const sync = focused.current?.element !== element || focused.current.sync !== session.sync
    if (sync) {
      focused.current = { element, sync: session.sync }
      element.focus({ preventScroll: true })
    } else if (element.ownerDocument.activeElement !== element) return
    if (sync && session.entry.kind === "point" && session.sync === 1) {
      const place = placeAt(element.ownerDocument, session.entry.x, session.entry.y)
      const offset = place === null ? null : offsetOfPlace(element, place)
      const at = offset ?? session.draft.chars.length
      latest.current.api.select(at, at)
      showSelection(element, at, at)
      return
    }
    showSelection(element, session.anchor, session.focus)
  }, [session.sync, fresh, session.draft, lines, followFormatting])

  useEffect(() => {
    const element = host.current
    if (element === null) return
    const doc = element.ownerDocument
    const selected = () => (marked.current === null && host.current === element ? selectionOf(element) : null)
    function listen() {
      const found = selected()
      if (found !== null) latest.current.api.select(found.anchor, found.focus)
    }
    function before(event: InputEvent) {
      const type = event.inputType
      const turning = type === "historyUndo" || type === "historyRedo"
      if (marked.current !== null && turning) event.preventDefault()
      if (marked.current !== null || type === "insertCompositionText") return
      event.preventDefault()
      const { api: current, session: now } = latest.current
      const at = selectionOf(element!) ?? { anchor: now.anchor, focus: now.focus }
      const from = Math.min(at.anchor, at.focus)
      const to = Math.max(at.anchor, at.focus)
      const chars = now.draft.chars
      const collapsed = from === to
      if (type === "insertText" || type === "insertReplacementText") {
        const data = event.data ?? event.dataTransfer?.getData("text/plain") ?? ""
        if (data !== "") current.replace(from, to, data, type === "insertText" ? "typing" : undefined)
      } else if (type === "insertParagraph" || type === "insertLineBreak") {
        const para = now.draft.paras[chars.slice(0, from).split("\n").length - 1]
        const lineStart = chars.lastIndexOf("\n", from - 1) + 1
        const lineEnd = chars.indexOf("\n", from) === -1 ? chars.length : chars.indexOf("\n", from)
        if (collapsed && para?.list !== undefined && lineStart === lineEnd) current.list(para.list)
        else current.replace(from, to, "\n")
      } else if (type === "deleteContentBackward") {
        current.replace(collapsed ? graphemeBefore(chars, from) : from, to, "", "deleting")
      } else if (type === "deleteContentForward") {
        current.replace(from, collapsed ? graphemeAfter(chars, to) : to, "", "deleting")
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
        pasteFrom(event.dataTransfer, from, to)
      } else if (turning) {
        current.step(type === "historyUndo" ? "undo" : "redo")
      }
    }
    latest.current.api.host(selected)
    doc.addEventListener("selectionchange", listen)
    element.addEventListener("focusout", listen)
    element.addEventListener("beforeinput", before)
    return () => {
      latest.current.api.host(null)
      doc.removeEventListener("selectionchange", listen)
      element.removeEventListener("focusout", listen)
      element.removeEventListener("beforeinput", before)
    }
  }, [fresh])

  function keys(event: React.KeyboardEvent) {
    if (composing(event)) return
    const gesture = gestureFor(event.nativeEvent, "text") ?? gestureFor(event.nativeEvent, "editor")
    const { api: current } = latest.current
    const handled = () => event.preventDefault()
    if (gesture === "deselect") {
      handled()
      latest.current.onLeave()
    } else if (gesture === "select-all") {
      handled()
      const end = latest.current.session.draft.chars.length
      current.select(0, end)
      if (host.current !== null) showSelection(host.current, 0, end)
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

  function pasteFrom(transfer: DataTransfer | null, from: number, to: number) {
    if (transfer === null) return
    const { api: current, deck: currentDeck, slides: currentSlides } = latest.current
    const slice = readTextClipboard(transfer, { deck: currentDeck, slides: currentSlides })
    if (slice !== null && slice.chars !== "") {
      current.paste(from, to, slice)
      return
    }
    const data = transfer.getData("text/plain").replace(/\r\n?/g, "\n")
    if (data !== "") current.replace(from, to, data)
  }

  function copy(event: React.ClipboardEvent, cut: boolean) {
    const { api: current, session: now, deck: currentDeck } = latest.current
    const at = (host.current === null ? null : selectionOf(host.current)) ?? { anchor: now.anchor, focus: now.focus }
    const from = Math.min(at.anchor, at.focus)
    const to = Math.max(at.anchor, at.focus)
    event.preventDefault()
    if (from === to) return
    writeTextClipboard(event.clipboardData, sliceText(now.draft, from, to), currentDeck)
    if (cut) current.replace(from, to, "")
  }

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
        ...(session.draft.overflow === "ellipsis" ? { overflow: "auto", scrollbarWidth: "none" } : {}),
      }}
      onKeyDown={keys}
      onCopy={(event) => copy(event, false)}
      onCut={(event) => copy(event, true)}
      onPaste={(event) => {
        event.preventDefault()
        const { session: now } = latest.current
        const at = (host.current === null ? null : selectionOf(host.current)) ?? {
          anchor: now.anchor,
          focus: now.focus,
        }
        pasteFrom(event.clipboardData, Math.min(at.anchor, at.focus), Math.max(at.anchor, at.focus))
      }}
      onCompositionStart={() => {
        const found = host.current === null ? null : selectionOf(host.current)
        const now = latest.current.session
        const at = found ?? { anchor: now.anchor, focus: now.focus }
        marked.current = { from: Math.min(at.anchor, at.focus), to: Math.max(at.anchor, at.focus) }
      }}
      onCompositionEnd={(event) => {
        const range = marked.current
        if (range === null) return
        flushSync(() => {
          latest.current.api.replace(range.from, range.to, event.data)
          marked.current = null
          setFresh((value) => value + 1)
        })
      }}
    >
      <TextLines lines={lines} editing />
    </div>
  )
}
