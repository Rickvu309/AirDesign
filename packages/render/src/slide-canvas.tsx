import { useLayoutEffect, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react"
import type { Box, ElementId, Kind } from "@airdesign/document"
import { paintedAt } from "./box-gesture.js"
import { useBox, useElement } from "./element-view.js"
import { paragraphText, textValue } from "./paragraph-edit.js"
import { Passage } from "./passage.js"
import type { CanvasElement, CanvasSlide, CanvasText, PaintBox } from "./record.js"
import { SelectionFrame } from "./selection-frame.js"
import { canMove, canResize, useMoves, type Moves } from "./slide-moves.js"
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

const kindNames: Partial<Record<Kind, string>> = { picture: "Image", chart: "Chart", connector: "Line" }

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

function lines(text: string): readonly string[] {
  return textValue(text).flatMap((paragraph) => paragraphText(paragraph).split(/\r\n|[\r\n\v\f\u2028\u2029]/))
}

function isBlank(text: string): boolean {
  return lines(text).every((line) => line.trim() === "")
}

function nameOf(element: CanvasElement, text: string): string {
  return (
    lines(text)
      .find((line) => line.trim() !== "")
      ?.trim() ??
    kindNames[element.kind] ??
    "Shape"
  )
}

function takesPointer(element: CanvasElement, text: string, moving: boolean): boolean {
  const movable = moving && canMove(element)
  if (!element.editable && !movable) return false
  const drawn = movable && element.kind === "picture"
  return drawn || element.placeholder || element.filled || element.box === null || !isBlank(text)
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

function LineArt(props: { readonly element: CanvasElement; readonly scaled: Scaled; readonly grab?: boolean }) {
  const { element, scaled } = props
  if (element.line === null || element.box === null) return null
  const width = scaled(element.box.width)
  const height = scaled(element.box.height)
  const weight = scaled(element.line.width)
  const stroke = {
    fill: "none",
    stroke: element.line.color,
    strokeWidth: weight,
    ...(props.grab === true ? { style: { pointerEvents: "visibleStroke", cursor: "move" } as const } : {}),
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

type ShownRun = { readonly from: number; readonly text: string }
type ShownParagraph = { readonly from: number; readonly runs: readonly ShownRun[] }

function ShownText(props: { readonly paragraphs: readonly ShownParagraph[]; readonly look: TextLook }) {
  const { look, paragraphs } = props
  return (
    <div style={look.body}>
      {paragraphs.map((paragraph) => {
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

function SheetText(props: { readonly text: CanvasText; readonly look: TextLook }) {
  return <ShownText look={props.look} paragraphs={props.text.paragraphs} />
}

function LiveText(props: {
  readonly store: PaintStore
  readonly id: ElementId
  readonly text: CanvasText
  readonly scaled: Scaled
}) {
  const record = useElement(props.store, props.id)
  return <ShownText look={textLook(props.text, props.scaled)} paragraphs={textValue(record?.text ?? "")} />
}

function QuietElement(props: { readonly store: PaintStore; readonly element: CanvasElement; readonly scaled: Scaled }) {
  const { element, scaled, store } = props
  const text = element.text
  return (
    <div style={frame(element, scaled, false)}>
      <LineArt element={element} scaled={scaled} />
      {text === null ? null : (
        <div style={textLayer(element.box, text, scaled)}>
          {element.id === null ? (
            <SheetText look={textLook(text, scaled)} text={text} />
          ) : (
            <LiveText id={element.id} scaled={scaled} store={store} text={text} />
          )}
        </div>
      )}
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

function reach(element: CanvasElement, id: ElementId, text: string, moves: Moves, typing: boolean) {
  return {
    role: "group",
    "aria-label": nameOf(element, text),
    tabIndex: canMove(element) && !typing ? 0 : -1,
    onPointerDown: (event: PointerEvent<HTMLElement>) => moves.press(event, element, "move"),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => moves.key(event, element),
    onFocus: () => moves.select(id),
  }
}

function PlacedText(props: {
  readonly store: PaintStore
  readonly element: CanvasElement
  readonly id: ElementId
  readonly scaled: Scaled
  readonly onEdit?: ((id: ElementId, value: string) => void) | undefined
  readonly moves: Moves | null
}) {
  const { id, moves, onEdit, scaled, store } = props
  const record = useElement(store, id)
  const box = paintedAt(props.element.box, useBox(store, id))
  const element = box === props.element.box ? props.element : { ...props.element, box }
  const text = element.text ?? noText
  const look = textLook(text, scaled)
  const shown = record?.text ?? ""
  const typing = element.editable && onEdit !== undefined
  return (
    <div
      data-canvas-element={element.key}
      style={{
        ...frame(element, scaled, takesPointer(element, shown, moves !== null)),
        ...(moves === null ? {} : { outline: "none" }),
        ...(moves === null || typing || !canMove(element) ? {} : { cursor: "move", touchAction: "none" }),
      }}
      {...(moves === null ? {} : reach(element, id, shown, moves, typing))}
    >
      <LineArt element={element} grab={moves !== null && canMove(element)} scaled={scaled} />
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
        background: slide.background ?? "white",
        color: "black",
        fontSize: scaled(defaultTextSize),
        ...(moving === null ? {} : { outline: "none" }),
      }}
      {...(moving === null ? {} : { tabIndex: -1, ...moving.slide })}
    >
      {slide.elements.map((element) =>
        quiet ? (
          <QuietElement key={element.key} element={element} scaled={scaled} store={props.store} />
        ) : element.id === null ? (
          <SheetElement key={element.key} element={element} scaled={scaled} />
        ) : (
          <PlacedText
            key={element.key}
            element={element}
            id={element.id}
            moves={moving}
            onEdit={props.onEdit}
            scaled={scaled}
            store={props.store}
          />
        ),
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
