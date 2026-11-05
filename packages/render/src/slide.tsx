import { memo, useLayoutEffect, useRef } from "react"
import type { CSSProperties, PointerEventHandler } from "react"
import type { Element, Id, Slide as DeckSlide } from "../../deck/src/model.ts"
import { fontReport } from "./fonts.ts"
export type CommitText = (id: Id, text: string) => void
function position(element: Element): CSSProperties {
  return { position: "absolute", insetInlineStart: element.box.x, insetBlockStart: element.box.y, inlineSize: element.box.width, blockSize: element.box.height }
}
function Text({ element, commit }: { element: Extract<Element, { kind: "text" }>; commit: CommitText | undefined }) {
  const ref = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  const localText = useRef<string | null>(null)
  const text = element.runs.map(r => r.text).join("")
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || composing.current) return
    if (localText.current === text) { localText.current = null; return }
    node.replaceChildren(...element.runs.map(run => {
      const span = node.ownerDocument.createElement("span")
      span.textContent = run.text
      Object.assign(span.style, { fontFamily: "Geist", fontSize: `${run.size}px`, fontWeight: run.bold ? "600" : "400", color: run.color })
      return span
    }))
  }, [element, text])
  return <div ref={ref} data-text={element.id} role={commit ? "textbox" : undefined} aria-label={commit ? `Text ${element.id}` : undefined} aria-multiline={commit ? true : undefined} contentEditable={Boolean(commit) && element.support.kind === "native"} suppressContentEditableWarning spellCheck style={{ inlineSize: "100%", blockSize: "100%", whiteSpace: "pre-wrap", overflowWrap: "break-word", lineHeight: 1.2, fontFamily: "Geist", fontSize: element.runs[0]?.size, fontWeight: element.runs[0]?.bold ? 600 : 400, color: element.runs[0]?.color }} onCompositionStart={() => { composing.current = true }} onCompositionEnd={event => { composing.current = false; localText.current = event.currentTarget.textContent; commit?.(element.id, event.currentTarget.textContent ?? "") }} onInput={event => { if (!composing.current) { localText.current = event.currentTarget.textContent; commit?.(element.id, event.currentTarget.textContent ?? "") } }} />
}
const Item = memo(function Item({ element, commit, pointerDown }: { element: Element; commit: CommitText | undefined; pointerDown: PointerEventHandler<HTMLDivElement> | undefined }) {
  let content
  if (element.support.kind !== "native") {
    content = element.support.preview ? <img src={element.support.preview} alt={`${element.support.kind} object ${element.id}`} style={{ inlineSize: "100%", blockSize: "100%" }} /> : <div role="img" aria-label={`Preview unavailable for ${element.id}`}>Preview unavailable</div>
  } else {
    switch (element.kind) {
      case "group": content = element.children.map(child => <Item key={child.id} element={child} commit={commit} pointerDown={pointerDown} />); break
      case "text": content = <Text element={element} commit={commit} />; break
      case "shape": content = <svg width="100%" height="100%" viewBox={`0 0 ${element.box.width} ${element.box.height}`} aria-label={`${element.geometry} ${element.id}`} style={{ pointerEvents: "none" }}>
        {element.geometry === "rectangle" ? <rect width={element.box.width} height={element.box.height} fill={element.fill} style={{ pointerEvents: "visiblePainted" }} /> : element.geometry === "ellipse" ? <ellipse cx={element.box.width / 2} cy={element.box.height / 2} rx={element.box.width / 2} ry={element.box.height / 2} fill={element.fill} style={{ pointerEvents: "visiblePainted" }} /> : <path d={`M ${element.box.width / 2} 0 L ${element.box.width} ${element.box.height} L 0 ${element.box.height} Z`} fill={element.fill} style={{ pointerEvents: "visiblePainted" }} />}
      </svg>; break
      default: { const exhaustive: never = element; return exhaustive }
    }
  }
  return <div data-element={element.id} data-kind={element.kind} style={{ ...position(element), pointerEvents: element.kind === "shape" && element.support.kind === "native" ? "none" : undefined }} onPointerDown={pointerDown}>{content}</div>
})
export function Slide({ slide, commitText, onPointerDown }: { slide: DeckSlide; commitText?: CommitText; onPointerDown?: PointerEventHandler<HTMLDivElement> }) {
  const fonts = fontReport(slide)
  return <section aria-label={`Slide ${slide.id}`}>
    {fonts.missing.length > 0 && <p role="status" data-font-warning="">Missing fonts: {fonts.missing.join(", ")}. Using pinned Geist.</p>}
    <div data-slide={slide.id} data-version={slide.version} style={{ position: "relative", inlineSize: slide.size.width, blockSize: slide.size.height, background: "white", overflow: "clip" }}>
      {slide.elements.map(element => <Item key={element.id} element={element} commit={commitText} pointerDown={onPointerDown} />)}
    </div>
  </section>
}
