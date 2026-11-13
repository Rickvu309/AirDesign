import { useLayoutEffect, useRef } from "react"
import type { Box, ElementId, TableChange } from "@airdesign/document"
import { PaintedElement } from "./element-kind.js"
import { changeSaid, namedFrames, shownPart, type Named } from "./element-said.js"
import { SelectionFrame } from "./selection-frame.js"
import { slideBackground } from "./slide-background.js"
import { canMove, canResize, enterElement, useMoves } from "./slide-moves.js"
import type { CanvasSlide } from "./record.js"
import type { TableBar } from "./table-paint.js"
import type { PaintStore } from "./store.js"
import { ensureBulletRule, type Scaled } from "./text-look.js"
import type { TextFormatting } from "./text-formatting.js"

const defaultTextSize = 203_200

const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const

export { unshownFill } from "./unshown-fill.js"

export function SlideCanvas(props: {
  readonly store: PaintStore
  readonly slide: CanvasSlide
  readonly width: number
  readonly className?: string
  readonly quiet?: boolean
  readonly onEdit?: (id: ElementId, value: string) => void
  readonly onBox?: (id: ElementId, box: Box) => void
  readonly onRemove?: (id: ElementId) => void
  readonly onTable?: (id: ElementId, change: TableChange) => void
  readonly tableBar?: TableBar
  readonly entering?: ElementId | null
  readonly formatting?: TextFormatting
}) {
  const { slide, width } = props
  const quiet = props.quiet === true
  const scaled: Scaled = (emu) => (emu * width) / slide.width
  useLayoutEffect(() => {
    ensureBulletRule(document)
  }, [])
  const moves = useMoves(props.store, slide, width, props.onBox, props.onRemove)
  const moving = props.onBox === undefined ? null : moves
  const selected = moving === null ? undefined : slide.elements.find((each) => each.id === moving.selected)
  const surface = useRef<HTMLDivElement>(null)
  const entered = useRef<ElementId | null>(null)
  const entering = slide.elements.find((each) => each.id !== null && each.id === props.entering)
  const named = useRef<{ frames: Named; part: string | null }>({ frames: new Map(), part: null })
  const say = moving?.say
  useLayoutEffect(() => {
    const host = surface.current
    if (host === null || say === undefined) return
    const frames = namedFrames(host)
    const said = changeSaid(named.current.frames, frames, named.current.part)
    named.current = { frames, part: shownPart(frames, named.current.part) }
    if (said !== null) say(said)
  }, [slide, say])
  useLayoutEffect(() => {
    const host = surface.current
    if (entering?.id === undefined || entering.id === null || host === null || entered.current === entering.id) return
    entered.current = entering.id
    enterElement(host, entering)
  }, [entering])
  return (
    <div
      ref={surface}
      {...(quiet ? { "data-thumb-paint": true } : { "data-slide-paint": true })}
      className={props.className}
      style={{
        position: "relative",
        width,
        height: scaled(slide.height),
        background: slideBackground(slide.background),
        color: "black",
        fontSize: scaled(defaultTextSize),
        ...(moving === null ? {} : { outline: "none" }),
      }}
      {...(moving === null ? {} : { tabIndex: -1, ...moving.slide })}
    >
      {slide.elements.map((element) => (
        <PaintedElement
          key={element.key}
          element={element}
          formatting={props.formatting}
          moves={moving}
          onEdit={props.onEdit}
          onTable={props.onTable}
          tableBar={props.tableBar}
          quiet={quiet}
          scaled={scaled}
          store={props.store}
        />
      ))}
      {moving === null ? null : (
        <div role="status" aria-live="polite" aria-atomic="true" style={visuallyHidden}>
          {moving.message}
        </div>
      )}
      {moving === null || selected === undefined || selected.id === null ? null : (
        <SelectionFrame
          element={selected}
          id={selected.id}
          movable={canMove(selected)}
          onPress={(event, grip) => moving.press(event, selected, grip)}
          resizable={canResize(selected)}
          scaled={scaled}
          store={props.store}
        />
      )}
    </div>
  )
}
