import type { CSSProperties } from "react"
import type { ElementId } from "@airdesign/document"
import { Passage } from "./passage.js"
import type { CanvasElement, CanvasSlide, PaintBox } from "./record.js"
import type { PaintStore } from "./store.js"

const defaultTextSize = 203_200
const defaultInsetX = 91_440
const defaultInsetY = 45_720
const unshownFill = "var(--line)"

type Scaled = (emu: number) => number

function turned(box: PaintBox): string | undefined {
  const turns: string[] = []
  if (box.rotation !== 0) turns.push(`rotate(${box.rotation}deg)`)
  if (box.flipH || box.flipV) turns.push(`scale(${box.flipH ? -1 : 1}, ${box.flipV ? -1 : 1})`)
  return turns.length === 0 ? undefined : turns.join(" ")
}

function placement(box: PaintBox | null, scaled: Scaled): CSSProperties {
  if (box === null) return {}
  const transform = turned(box)
  return {
    position: "absolute",
    left: scaled(box.x),
    top: scaled(box.y),
    width: scaled(box.width),
    height: scaled(box.height),
    ...(transform === undefined ? {} : { transform }),
  }
}

function textLayer(box: PaintBox | null, scaled: Scaled): CSSProperties {
  const mirrored = box !== null && box.flipH !== box.flipV
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    height: "100%",
    padding: `${scaled(defaultInsetY)}px ${scaled(defaultInsetX)}px`,
    ...(mirrored ? { transform: "scaleX(-1)" } : {}),
  }
}

function PlacedElement(props: {
  readonly store: PaintStore
  readonly element: CanvasElement
  readonly scaled: Scaled
  readonly onEdit?: ((id: ElementId, value: string) => void) | undefined
}) {
  const { element, onEdit, scaled, store } = props
  const { box, editable, id, key, kind } = element
  const unshown = kind === "picture" || kind === "chart"
  return (
    <div
      data-canvas-element={key}
      style={{
        ...placement(box, scaled),
        pointerEvents: editable ? "auto" : "none",
        ...(unshown ? { background: unshownFill } : {}),
      }}
    >
      {id === null ? null : (
        <div style={textLayer(box, scaled)}>
          {editable && onEdit !== undefined ? (
            <Passage id={id} onEdit={(value) => onEdit(id, value)} store={store} />
          ) : (
            <Passage id={id} store={store} />
          )}
        </div>
      )}
    </div>
  )
}

export function SlideCanvas(props: {
  readonly store: PaintStore
  readonly slide: CanvasSlide
  readonly width: number
  readonly className?: string
  readonly onEdit?: (id: ElementId, value: string) => void
}) {
  const { slide, width } = props
  const scaled: Scaled = (emu) => (emu * width) / slide.width
  return (
    <div
      data-slide-paint
      className={props.className}
      style={{
        position: "relative",
        width,
        height: scaled(slide.height),
        background: "white",
        color: "black",
        fontSize: scaled(defaultTextSize),
      }}
    >
      {slide.elements.map((element) => (
        <PlacedElement key={element.key} element={element} onEdit={props.onEdit} scaled={scaled} store={props.store} />
      ))}
    </div>
  )
}
