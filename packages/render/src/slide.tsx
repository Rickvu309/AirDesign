import { memo, useLayoutEffect, useRef } from "react"
import type { CSSProperties, PointerEventHandler } from "react"
import type { Element, Id, Run, Deck, Slide as DeckSlide } from "../../deck/src/model.ts"
import { canonicalChildren, normalizeEditable } from "./editable-input.ts"
import { editableRuns } from "./editable-runs.ts"
import { fontReport } from "./fonts.ts"
export type CommitText = (id: Id, runs: [Run, ...Run[]]) => void
function position(element: Element): CSSProperties {
  return { position: "absolute", insetInlineStart: element.box.x, insetBlockStart: element.box.y, inlineSize: element.box.width, blockSize: element.box.height }
}
function Text({ element, commit, themeFont }: { themeFont: string | undefined; element: Extract<Element, { kind: "text" }>; commit: CommitText | undefined }) {
  const ref = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  const insertingPlainText = useRef(false)
  const caretStyle = useRef(element.runs[0])
  const localRuns = useRef<string | null>(null)
  const signature = JSON.stringify(element.runs)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || composing.current) return
    if (localRuns.current === signature) { localRuns.current = null; return }
    caretStyle.current = element.runs[0]
    canonicalChildren(node, element.runs)
  }, [element, signature])
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || !commit) return
    const rememberStyle = () => {
      const anchor = node.ownerDocument.getSelection()?.anchorNode
      const span = anchor instanceof node.ownerDocument.defaultView!.Element ? anchor.closest("[data-run-style]") : anchor?.parentElement?.closest("[data-run-style]")
      if (!span || !node.contains(span)) return
      const run = element.runs.find(run => JSON.stringify({ ...run, text: "" }) === span.getAttribute("data-run-style"))
      if (run) caretStyle.current = run
    }
    const interceptInput = (event: InputEvent) => {
      rememberStyle()
      if (event.inputType.startsWith("format")) { event.preventDefault(); return }
      const transfer = event.dataTransfer
      if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop" || event.inputType === "insertReplacementText" || transfer?.types.includes("text/html")) {
        event.preventDefault()
        if (!composing.current) {
          node.focus()
          const selection = node.ownerDocument.getSelection()
          const target = event.getTargetRanges()[0]
          if (target && node.contains(target.startContainer) && node.contains(target.endContainer)) {
            const range = node.ownerDocument.createRange()
            range.setStart(target.startContainer, target.startOffset)
            range.setEnd(target.endContainer, target.endOffset)
            selection?.removeAllRanges()
            selection?.addRange(range)
          } else if (!selection?.anchorNode || !node.contains(selection.anchorNode) || !selection.focusNode || !node.contains(selection.focusNode)) {
            const range = node.ownerDocument.createRange()
            range.selectNodeContents(node)
            range.collapse(false)
            selection?.removeAllRanges()
            selection?.addRange(range)
          }
          rememberStyle()
          insertingPlainText.current = true
          try { node.ownerDocument.execCommand("insertText", false, transfer?.getData("text/plain") ?? event.data ?? "") }
          finally { insertingPlainText.current = false }
        }
      }
    }
    node.ownerDocument.addEventListener("selectionchange", rememberStyle)
    node.addEventListener("beforeinput", interceptInput)
    return () => { node.removeEventListener("beforeinput", interceptInput); node.ownerDocument.removeEventListener("selectionchange", rememberStyle) }
  }, [commit, element.runs])
  function save(node: HTMLDivElement) {
    const runs = editableRuns(node, element.runs, caretStyle.current)
    if (!insertingPlainText.current) normalizeEditable(node, runs)
    localRuns.current = JSON.stringify(runs)
    commit?.(element.id, runs)
  }
  return <div ref={ref} data-text={element.id} data-theme-font={themeFont} role={commit ? "textbox" : undefined} aria-label={commit ? `Text ${element.id}` : undefined} aria-multiline={commit ? true : undefined} contentEditable={Boolean(commit) && element.support.kind === "native"} suppressContentEditableWarning spellCheck style={{ inlineSize: "100%", blockSize: "100%", whiteSpace: "pre-wrap", overflowWrap: "break-word", lineHeight: 1.2, fontFamily: "Geist", fontSize: element.runs[0]?.size, fontWeight: element.runs[0]?.bold ? 600 : 400, color: element.runs[0]?.color }} onDragOver={event => event.preventDefault()} onDrop={event => {
    event.preventDefault()
    if (composing.current) return
    const node = event.currentTarget
    const document = node.ownerDocument
    node.focus()
    const point = document.caretPositionFromPoint?.(event.clientX, event.clientY)
    const range = document.createRange()
    if (point && node.contains(point.offsetNode)) {
      range.setStart(point.offsetNode, point.offset)
    } else {
      const fallback = document.caretRangeFromPoint(event.clientX, event.clientY)
      if (fallback && node.contains(fallback.startContainer)) range.setStart(fallback.startContainer, fallback.startOffset)
      else { range.selectNodeContents(node); range.collapse(false) }
    }
    range.collapse(true)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    node.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertFromDrop", dataTransfer: event.dataTransfer, bubbles: true, cancelable: true }))
  }} onCompositionStart={() => { composing.current = true }} onCompositionEnd={event => { composing.current = false; save(event.currentTarget) }} onInput={event => { if (!composing.current) { save(event.currentTarget) } }} />
}
const Item = memo(function Item({ element, commit, pointerDown, themes, inheritedTheme }: { themes: Deck["themes"]; inheritedTheme: DeckSlide["theme"]; element: Element; commit: CommitText | undefined; pointerDown: PointerEventHandler<HTMLDivElement> | undefined }) {
  const theme = themes.find(t => t.id === (element.theme ?? inheritedTheme))
  let content
  if (element.support.kind !== "native") {
    content = element.support.preview ? <img src={element.support.preview} alt={`${element.support.kind} object ${element.id}`} style={{ inlineSize: "100%", blockSize: "100%" }} /> : <div role="img" aria-label={`Preview unavailable for ${element.id}`}>Preview unavailable</div>
  } else {
    switch (element.kind) {
      case "group": content = element.children.map(child => <Item key={child.id} element={child} commit={commit} pointerDown={pointerDown} themes={themes} inheritedTheme={element.theme ?? inheritedTheme} />); break
      case "text": content = <Text element={element} commit={commit} themeFont={theme?.font} />; break
      case "shape": content = <svg width="100%" height="100%" viewBox={`0 0 ${element.box.width} ${element.box.height}`} aria-label={`${element.geometry} ${element.id}`} style={{ pointerEvents: "none" }}>
        {element.geometry === "rectangle" ? <rect width={element.box.width} height={element.box.height} fill={element.fill} style={{ pointerEvents: "visiblePainted" }} /> : element.geometry === "ellipse" ? <ellipse cx={element.box.width / 2} cy={element.box.height / 2} rx={element.box.width / 2} ry={element.box.height / 2} fill={element.fill} style={{ pointerEvents: "visiblePainted" }} /> : <path d={`M ${element.box.width / 2} 0 L ${element.box.width} ${element.box.height} L 0 ${element.box.height} Z`} fill={element.fill} style={{ pointerEvents: "visiblePainted" }} />}
      </svg>; break
      default: { const exhaustive: never = element; return exhaustive }
    }
  }
  return <div data-element={element.id} data-kind={element.kind} style={{ ...position(element), pointerEvents: element.kind === "shape" && element.support.kind === "native" ? "none" : undefined }} onPointerDown={pointerDown}>{content}</div>
})
export function Slide({ slide, themes = [], commitText, onPointerDown }: { slide: DeckSlide; themes?: Deck["themes"]; commitText?: CommitText; onPointerDown?: PointerEventHandler<HTMLDivElement> }) {
  const fonts = fontReport(slide, themes)
  return <section aria-label={`Slide ${slide.id}`}>
    {fonts.missing.length > 0 && <p role="status" data-font-warning="">Missing fonts: {fonts.missing.join(", ")}. Using pinned Geist.</p>}
    <div data-slide={slide.id} data-version={slide.version} style={{ position: "relative", inlineSize: slide.size.width, blockSize: slide.size.height, background: themes.find(t => t.id === slide.theme)?.background ?? "white", overflow: "clip" }}>
      {slide.elements.map(element => <Item key={element.id} element={element} commit={commitText} pointerDown={onPointerDown} themes={themes} inheritedTheme={slide.theme} />)}
    </div>
  </section>
}
