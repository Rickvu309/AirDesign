import { type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react"
import type { ElementId, TableChange } from "@airdesign/document"
import { paintedAt } from "./box-gesture.js"
import { useBox, useElement } from "./element-view.js"
import { paragraphText, textValue } from "./paragraph-edit.js"
import { framedOutline, Passage } from "./passage.js"
import type { CanvasElement, CanvasText, PaintBox } from "./record.js"
import { ShapeArt, shapePaths } from "./shape-art.js"
import { SheetText } from "./sheet-text.js"
import { DiagramArt } from "./diagram-art.js"
import { ChartArt } from "./chart-art.js"
import type { TableBar } from "./table-paint.js"
import { canMove, type Moves } from "./slide-moves.js"
import type { PaintStore } from "./store.js"
import { anchored, textLook, type Scaled, type TextLook } from "./text-look.js"
import { formatKey, keepsFormat, type TextFormatting } from "./text-formatting.js"
import { unshownFill } from "./unshown-fill.js"
import { UnshownLabel } from "./unshown-label.js"

const defaultInsetX = 91_440
const defaultInsetY = 45_720
const defaultTextSize = 203_200
const roundCorner = 0.16667
const noText: CanvasText = {
  paragraphs: [],
  anchor: "top",
  insets: { left: defaultInsetX, top: defaultInsetY, right: defaultInsetX, bottom: defaultInsetY },
  wrap: true,
}

export type ElementPaintProps = {
  readonly store: PaintStore
  readonly element: CanvasElement
  readonly scaled: Scaled
  readonly quiet: boolean
  readonly onEdit?: ((id: ElementId, value: string) => void) | undefined
  readonly onTable?: ((id: ElementId, change: TableChange) => void) | undefined
  readonly tableBar?: TableBar | undefined
  readonly moves: Moves | null
  readonly formatting?: TextFormatting | undefined
}

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

export function textLayer(box: PaintBox | null, text: CanvasText, scaled: Scaled): CSSProperties {
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

function nameOf(text: string, fallback: string): string {
  return (
    lines(text)
      .find((line) => line.trim() !== "")
      ?.trim() ?? fallback
  )
}

function takesPointer(element: CanvasElement, text: string, moving: boolean, drawnWhenBlank: boolean): boolean {
  const movable = moving && canMove(element)
  if (!element.editable && !movable) return false
  const drawn = movable && drawnWhenBlank
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

export function elementFrame(
  element: CanvasElement,
  scaled: Scaled,
  pointer: boolean,
  unshown: boolean,
): CSSProperties {
  const background = unshown ? unshownFill : element.fill
  return {
    ...placement(element.box, scaled),
    ...rounding(element, scaled),
    pointerEvents: pointer ? "auto" : "none",
    ...(background === null || shapePaths(element, scaled) !== null ? {} : { background }),
  }
}

function LiveText(props: {
  readonly store: PaintStore
  readonly id: ElementId
  readonly text: CanvasText
  readonly scaled: Scaled
}) {
  const record = useElement(props.store, props.id)
  return <SheetText look={textLook(props.text, props.scaled)} text={{ paragraphs: textValue(record?.text ?? "") }} />
}

function QuietElement(props: {
  readonly store: PaintStore
  readonly element: CanvasElement
  readonly scaled: Scaled
  readonly unshown: boolean
}) {
  const { element, scaled, store, unshown } = props
  const text = element.text
  return (
    <div data-thumb-element={element.key} style={elementFrame(element, scaled, false, unshown)}>
      <ShapeArt element={element} scaled={scaled} />
      <DiagramArt element={element} scaled={scaled} />
      <ChartArt box={element.box} chart={element.chart} described={false} scaled={scaled} />
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

function SheetElement(props: { readonly element: CanvasElement; readonly scaled: Scaled; readonly unshown: boolean }) {
  const { element, scaled, unshown } = props
  const text = element.text
  return (
    <div data-canvas-element={element.key} style={elementFrame(element, scaled, false, unshown)}>
      <ShapeArt element={element} scaled={scaled} />
      <UnshownLabel box={element.box} scaled={scaled} text={element.unshownText} />
      <DiagramArt element={element} scaled={scaled} />
      <ChartArt box={element.box} chart={element.chart} described scaled={scaled} />
      {text === null ? null : (
        <div style={textLayer(element.box, text, scaled)}>
          <SheetText look={textLook(text, scaled)} text={text} />
        </div>
      )}
    </div>
  )
}

function reach(element: CanvasElement, id: ElementId, text: string, moves: Moves, typing: boolean, fallback: string) {
  return {
    role: "group",
    "aria-label": nameOf(text, fallback),
    "aria-description": `Arrow keys move. Alt and Shift with the arrow keys resize. ${element.editable ? "Enter edits the text. " : ""}Delete removes it.`,
    tabIndex: canMove(element) && !typing ? 0 : -1,
    onPointerDown: (event: PointerEvent<HTMLElement>) => moves.press(event, element, "move"),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => moves.key(event, element),
    onFocus: () => moves.select(id),
  }
}

function formatReach(
  formatting: TextFormatting | undefined,
  id: ElementId,
  moves: Moves | null,
  element: CanvasElement,
) {
  if (formatting === undefined) return {}
  return {
    onFocus: (event: FocusEvent<HTMLElement>) => {
      moves?.select(id)
      if (event.target instanceof HTMLElement) formatting.aim(id, event.target)
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (next instanceof Element && (event.currentTarget.contains(next) || next.closest(keepsFormat) !== null)) return
      formatting.aim(null)
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const format = formatKey(event)
      if (format === null) {
        moves?.key(event, element)
        return
      }
      event.preventDefault()
      formatting.toggle(format)
    },
  }
}

function promptLook(text: CanvasText, look: TextLook, scaled: Scaled): CSSProperties {
  const paragraph = text.paragraphs[0]
  if (paragraph === undefined) {
    return {
      fontFamily: "var(--font-sans)",
      fontSize: `${scaled(defaultTextSize)}px`,
      lineHeight: "normal",
      textAlign: "left",
    }
  }
  const base = look.paragraph(0, false)
  return {
    ...base,
    "--bullet": "none",
    margin: 0,
  } as CSSProperties
}

function PlacedText(props: {
  readonly store: PaintStore
  readonly element: CanvasElement
  readonly id: ElementId
  readonly scaled: Scaled
  readonly onEdit?: ((id: ElementId, value: string) => void) | undefined
  readonly moves: Moves | null
  readonly unshown: boolean
  readonly drawnWhenBlank: boolean
  readonly fallbackName: string
  readonly formatting: TextFormatting | undefined
}) {
  const { drawnWhenBlank, fallbackName, formatting, id, moves, onEdit, scaled, store, unshown } = props
  const record = useElement(store, id)
  const box = paintedAt(props.element.box, useBox(store, id))
  const element = box === props.element.box ? props.element : { ...props.element, box }
  const text = element.text ?? noText
  const look = textLook(text, scaled)
  const shown = record?.text ?? ""
  const typing = element.editable && onEdit !== undefined
  const empty = isBlank(shown)
  const isSelected = moves !== null && moves.selected === id
  const showPrompt = typing && element.placeholder && empty && Boolean(element.prompt)
  const filledFrame = element.diagram !== undefined || element.chart !== undefined
  const showQuietOutline = element.placeholder && empty && !isSelected && !filledFrame
  const promptOutline: CSSProperties = showQuietOutline
    ? { outline: "1px dashed var(--placeholder-edge)", outlineOffset: -1 }
    : moves === null
      ? {}
      : framedOutline
  return (
    <div
      data-canvas-element={element.key}
      style={{
        ...elementFrame(element, scaled, takesPointer(element, shown, moves !== null, drawnWhenBlank), unshown),
        ...promptOutline,
        ...(moves === null || typing || !canMove(element) ? {} : { cursor: "move", touchAction: "none" }),
      }}
      {...(moves === null
        ? {}
        : reach(
            element,
            id,
            shown,
            moves,
            typing,
            element.kind === "picture" ? fallbackName : (element.prompt ?? fallbackName),
          ))}
      {...(typing ? formatReach(formatting, id, moves, element) : {})}
    >
      <ShapeArt element={element} grab={moves !== null && canMove(element)} scaled={scaled} />
      <UnshownLabel box={element.box} scaled={scaled} text={element.unshownText} />
      <DiagramArt element={element} scaled={scaled} />
      <ChartArt box={element.box} chart={element.chart} described scaled={scaled} />
      <div style={textLayer(element.box, text, scaled)}>
        {showPrompt ? (
          <div
            aria-hidden="true"
            data-placeholder-prompt={element.prompt}
            style={{
              position: "absolute",
              left: scaled(text.insets.left),
              top: scaled(text.insets.top),
              right: scaled(text.insets.right),
              bottom: scaled(text.insets.bottom),
              display: "flex",
              flexDirection: "column",
              justifyContent: anchored[text.anchor],
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <div
              style={{
                ...promptLook(text, look, scaled),
                color: "var(--placeholder-prompt)",
              }}
            >
              {element.prompt}
            </div>
          </div>
        ) : null}
        {element.editable && onEdit !== undefined ? (
          <Passage
            formatting={formatting}
            framed={moves !== null}
            id={id}
            look={look}
            onEdit={(value) => onEdit(id, value)}
            prompt={showPrompt ? (element.prompt ?? undefined) : undefined}
            store={store}
          />
        ) : (
          <Passage id={id} look={look} prompt={showPrompt ? (element.prompt ?? undefined) : undefined} store={store} />
        )}
      </div>
    </div>
  )
}

export function ElementHost(
  props: ElementPaintProps & {
    readonly unshown: boolean
    readonly drawnWhenBlank: boolean
    readonly fallbackName: string
  },
) {
  const { drawnWhenBlank, element, fallbackName, formatting, moves, onEdit, quiet, scaled, store, unshown } = props
  if (quiet) return <QuietElement element={element} scaled={scaled} store={store} unshown={unshown} />
  if (element.id === null) return <SheetElement element={element} scaled={scaled} unshown={unshown} />
  return (
    <PlacedText
      drawnWhenBlank={drawnWhenBlank}
      element={element}
      fallbackName={fallbackName}
      formatting={formatting}
      id={element.id}
      moves={moves}
      onEdit={onEdit}
      scaled={scaled}
      store={store}
      unshown={unshown}
    />
  )
}
