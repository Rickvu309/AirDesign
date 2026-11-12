import { useLayoutEffect, type CSSProperties } from "react"
import type { ElementId } from "@airdesign/document"
import { useElement } from "./element-view.js"
import { paragraphText, textValue } from "./paragraph-edit.js"
import { Passage } from "./passage.js"
import type { CanvasElement, CanvasSlide, CanvasText, PaintBox } from "./record.js"
import type { PaintStore } from "./store.js"
import { anchored, ensureBulletRule, textLook, type Scaled, type TextLook } from "./text-look.js"

const defaultTextSize = 203_200
const defaultInsetX = 91_440
const defaultInsetY = 45_720
const roundCorner = 0.16667
const lineMinimum = 1
const noText: CanvasText = {
  paragraphs: [],
  anchor: "top",
  insets: { left: defaultInsetX, top: defaultInsetY, right: defaultInsetX, bottom: defaultInsetY },
  wrap: true,
}

export const unshownFill = "var(--line)"

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

function textLayer(box: PaintBox | null, text: CanvasText, scaled: Scaled): CSSProperties {
  const mirrored = box !== null && box.flipH !== box.flipV
  const { bottom, left, right, top } = text.insets
  return {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    justifyContent: anchored[text.anchor],
    height: "100%",
    padding: `${scaled(top)}px ${scaled(right)}px ${scaled(bottom)}px ${scaled(left)}px`,
    ...(mirrored ? { transform: "scaleX(-1)" } : {}),
  }
}

function isBlank(text: string): boolean {
  return textValue(text).every((paragraph) => paragraphText(paragraph).trim() === "")
}

function takesPointer(element: CanvasElement, text: string): boolean {
  if (!element.editable) return false
  return element.placeholder || element.filled || element.box === null || !isBlank(text)
}

function cornerOf(element: CanvasElement, scaled: Scaled): number {
  if (element.box === null) return 0
  return scaled(Math.min(element.box.width, element.box.height)) * roundCorner
}

function rounding(element: CanvasElement, scaled: Scaled): CSSProperties {
  if (element.outline === "ellipse") return { borderRadius: "50%" }
  return element.outline === "round" ? { borderRadius: cornerOf(element, scaled) } : {}
}

function frame(element: CanvasElement, scaled: Scaled, pointer: boolean): CSSProperties {
  const unshown = element.kind === "chart" || (element.kind === "picture" && element.fill === null)
  const background = unshown ? unshownFill : element.fill
  return {
    ...placement(element.box, scaled),
    ...rounding(element, scaled),
    pointerEvents: pointer ? "auto" : "none",
    ...(background === null ? {} : { background }),
  }
}

function LineArt(props: { readonly element: CanvasElement; readonly scaled: Scaled }) {
  const { element, scaled } = props
  if (element.line === null || element.box === null) return null
  const width = scaled(element.box.width)
  const height = scaled(element.box.height)
  const weight = scaled(element.line.width)
  const stroke = {
    fill: "none",
    stroke: element.line.color,
    strokeWidth: weight,
    ...(element.line.dash === null
      ? {}
      : { strokeDasharray: element.line.dash.map((step) => step * weight).join(" ") }),
  }
  return (
    <svg
      data-canvas-line
      width={Math.max(width, lineMinimum)}
      height={Math.max(height, lineMinimum)}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
    >
      {element.outline === "line" ? (
        <line x1={0} y1={0} x2={width} y2={height} {...stroke} />
      ) : element.outline === "ellipse" ? (
        <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} {...stroke} />
      ) : (
        <rect
          width={width}
          height={height}
          {...(element.outline === "round" ? { rx: cornerOf(element, scaled) } : {})}
          {...stroke}
        />
      )}
    </svg>
  )
}

function SheetText(props: { readonly text: CanvasText; readonly look: TextLook }) {
  const { look, text } = props
  return (
    <div style={look.body}>
      {text.paragraphs.map((paragraph) => {
        const filled = paragraph.runs.some((run) => run.text !== "")
        return (
          <div key={paragraph.from} data-paragraph={paragraph.from} style={look.paragraph(paragraph.from, filled)}>
            {paragraph.runs.map((run) => (
              <span key={run.from} style={look.run(paragraph.from, run.from)}>
                {run.text}
              </span>
            ))}
            {filled ? null : <br />}
          </div>
        )
      })}
    </div>
  )
}

function SheetElement(props: { readonly element: CanvasElement; readonly scaled: Scaled }) {
  const { element, scaled } = props
  const text = element.text
  return (
    <div data-canvas-element={element.key} style={frame(element, scaled, false)}>
      <LineArt element={element} scaled={scaled} />
      {text === null ? null : (
        <div style={textLayer(element.box, text, scaled)}>
          <SheetText look={textLook(text, scaled)} text={text} />
        </div>
      )}
    </div>
  )
}

function PlacedText(props: {
  readonly store: PaintStore
  readonly element: CanvasElement
  readonly id: ElementId
  readonly scaled: Scaled
  readonly onEdit?: ((id: ElementId, value: string) => void) | undefined
}) {
  const { element, id, onEdit, scaled, store } = props
  const record = useElement(store, id)
  const text = element.text ?? noText
  const look = textLook(text, scaled)
  return (
    <div data-canvas-element={element.key} style={frame(element, scaled, takesPointer(element, record?.text ?? ""))}>
      <LineArt element={element} scaled={scaled} />
      <div style={textLayer(element.box, text, scaled)}>
        {element.editable && onEdit !== undefined ? (
          <Passage id={id} look={look} onEdit={(value) => onEdit(id, value)} store={store} />
        ) : (
          <Passage id={id} look={look} store={store} />
        )}
      </div>
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
  useLayoutEffect(() => {
    ensureBulletRule(document)
  }, [])
  return (
    <div
      data-slide-paint
      className={props.className}
      style={{
        position: "relative",
        width,
        height: scaled(slide.height),
        background: slide.background ?? "white",
        color: "black",
        fontSize: scaled(defaultTextSize),
      }}
    >
      {slide.elements.map((element) =>
        element.id === null ? (
          <SheetElement key={element.key} element={element} scaled={scaled} />
        ) : (
          <PlacedText
            key={element.key}
            element={element}
            id={element.id}
            onEdit={props.onEdit}
            scaled={scaled}
            store={props.store}
          />
        ),
      )}
    </div>
  )
}
