import { useLayoutEffect } from "react"
import type { Box, ElementId } from "@airdesign/document"
import { PaintedElement } from "./element-kind.js"
import { SelectionFrame } from "./selection-frame.js"
import { slideBackground } from "./slide-background.js"
import { canMove, canResize, useMoves } from "./slide-moves.js"
import type { CanvasSlide } from "./record.js"
import type { PaintStore } from "./store.js"
import { ensureBulletRule, type Scaled } from "./text-look.js"

const defaultTextSize = 203_200

export { unshownFill } from "./unshown-fill.js"

export function SlideCanvas(props: {
  readonly store: PaintStore
  readonly slide: CanvasSlide
  readonly width: number
  readonly className?: string
  readonly quiet?: boolean
  readonly onEdit?: (id: ElementId, value: string) => void
  readonly onBox?: (id: ElementId, box: Box) => void
}) {
  const { slide, width } = props
  const quiet = props.quiet === true
  const scaled: Scaled = (emu) => (emu * width) / slide.width
  useLayoutEffect(() => {
    ensureBulletRule(document)
  }, [])
  const moves = useMoves(props.store, slide, width, props.onBox)
  const moving = props.onBox === undefined ? null : moves
  const selected = moving === null ? undefined : slide.elements.find((each) => each.id === moving.selected)
  return (
    <div
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
          moves={moving}
          onEdit={props.onEdit}
          quiet={quiet}
          scaled={scaled}
          store={props.store}
        />
      ))}
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
