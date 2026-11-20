import {
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react"
import type { ElementId } from "@airdesign/document"
import { memberAt } from "./box-gesture.js"
import { useFollowed, type Targets } from "./connector-follow.js"
import { restingBox, shownBox, useBox, useElement, useRotation, type BoxRead } from "./element-view.js"
import { paragraphText, textValue } from "./paragraph-edit.js"
import { framedOutline, Passage, type TextEditKind } from "./passage.js"
import type { CanvasElement, CanvasText, PaintBox } from "./record.js"
import { paintsFillAsSvg, ShapeArt } from "./shape-art.js"
import { SheetText } from "./sheet-text.js"
import { DiagramArt } from "./diagram-art.js"
import { ChartArt } from "./chart-art.js"
import { canDrag, canMove } from "./layer-movable.js"
import type { Moves } from "./slide-moves.js"
import type { PaintStore } from "./store.js"
import { anchored, flowModes, textLook, type Scaled, type TextLook } from "./text-look.js"
import { leadOf } from "./selection.js"
import { keepsFormat, runTextKey, textKeyOf, type TextFormatting } from "./text-formatting.js"
import { FillLayers } from "./fill-layers.js"
import { unshownFill } from "./unshown-fill.js"
import { textHeight, useTextFit } from "./text-fit.js"
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
  readonly slideHeight: number
  readonly scaled: Scaled
  readonly quiet: boolean
  readonly onEdit?: ((id: ElementId, value: string, kind: TextEditKind) => void) | undefined
  readonly onFit?: ((id: ElementId, height: number) => void) | undefined
  readonly moves: Moves | null
  readonly formatting?: TextFormatting | undefined
  readonly targets?: Targets | undefined
}

function useFitReport(
  layer: RefObject<HTMLDivElement | null>,
  placed: CanvasElement,
  scaled: Scaled,
  report: (height: number) => void,
) {
  const reported = useRef<number | null>(null)
  const answered = useRef(false)
  useLayoutEffect(() => {
    const shown = layer.current
    const stored = placed.box?.height
    const owed = placed.measure === "owed"
    if (!owed) answered.current = false
    if (shown === null || stored === undefined || placed.inFrame !== "auto") return
    const grows = placed.text?.fit?.kind === "grow"
    const measured = grows ? textHeight(shown, placed.measure !== undefined) : null
    const unit = scaled(1)
    if (unit <= 0 || (grows && measured === null)) return
    const height = measured === null ? stored : Math.round(measured / unit)
    const answers = owed && !answered.current
    if (!answers && (Math.abs(height - stored) * unit < 1 || reported.current === height)) return
    answered.current = owed
    reported.current = height
    report(height)
  })
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
    ...flowModes[text.flow ?? "horz"],
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

function grabbed(element: CanvasElement): boolean {
  return canMove(element) || element.group !== undefined
}

function takesPointer(element: CanvasElement, blank: boolean, moving: boolean, drawnWhenBlank: boolean): boolean {
  if (element.locked === true) return false
  const movable = moving && grabbed(element)
  if (element.backdrop === true) return movable
  if (!element.editable && !movable) return false
  const drawn = movable && drawnWhenBlank
  return drawn || element.placeholder || element.filled || element.box === null || !blank
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
  const split = !unshown && element.layers !== undefined
  const background = unshown ? unshownFill : split ? null : element.fill
  return {
    ...placement(element.box, scaled),
    ...rounding(element, scaled),
    pointerEvents: pointer ? "auto" : "none",
    ...(background === null || paintsFillAsSvg(element, scaled) ? {} : { background }),
    ...(split ? { overflow: "hidden" } : {}),
    ...(element.mask === true ? { opacity: 0 } : {}),
  }
}

function usePlaced(
  store: PaintStore,
  element: CanvasElement,
  id: ElementId,
  targets: Targets | undefined,
  read: BoxRead = shownBox,
): CanvasElement {
  const group = element.group
  const carried = useBox(store, group?.id ?? id, read)
  const box = memberAt(element, useBox(store, id, read), useRotation(store, id), carried)
  return useFollowed(store, box === element.box ? element : { ...element, box }, targets, read)
}

type QuietProps = {
  readonly store: PaintStore
  readonly element: CanvasElement
  readonly scaled: Scaled
  readonly unshown: boolean
}

function QuietElement(props: QuietProps & { readonly targets: Targets | undefined }) {
  const id = props.element.id
  return id === null ? <QuietFrame {...props} written="" /> : <QuietLive {...props} id={id} />
}

function QuietLive(props: QuietProps & { readonly id: ElementId; readonly targets: Targets | undefined }) {
  const record = useElement(props.store, props.id)
  const element = usePlaced(props.store, props.element, props.id, props.targets, restingBox)
  return <QuietFrame {...props} element={element} written={record?.text ?? ""} />
}

function QuietFrame(props: QuietProps & { readonly written: string }) {
  const { scaled, unshown } = props
  const { element, layer } = useTextFit(props.element, scaled, props.written)
  const text = element.text
  return (
    <div
      data-thumb-element={element.key}
      data-thumb-node={element.id ?? undefined}
      style={elementFrame(element, scaled, false, unshown)}
    >
      <FillLayers element={element} scaled={scaled} unshown={unshown || paintsFillAsSvg(element, scaled)} />
      <ShapeArt element={element} scaled={scaled} />
      <DiagramArt element={element} scaled={scaled} />
      <ChartArt box={element.box} chart={element.chart} described={false} scaled={scaled} />
      {text === null ? null : (
        <div ref={layer} style={textLayer(element.box, text, scaled)}>
          {element.id === null ? (
            <SheetText look={textLook(text, scaled)} text={text} />
          ) : (
            <SheetText look={textLook(text, scaled)} text={{ paragraphs: textValue(props.written) }} />
          )}
        </div>
      )}
    </div>
  )
}

function SheetElement(props: { readonly element: CanvasElement; readonly scaled: Scaled; readonly unshown: boolean }) {
  const { scaled, unshown } = props
  const { element, layer } = useTextFit(props.element, scaled, "")
  const text = element.text
  return (
    <div data-canvas-element={element.key} style={elementFrame(element, scaled, false, unshown)}>
      <FillLayers element={element} scaled={scaled} unshown={unshown || paintsFillAsSvg(element, scaled)} />
      <ShapeArt element={element} scaled={scaled} />
      <UnshownLabel box={element.box} scaled={scaled} text={element.unshownText} />
      <DiagramArt element={element} scaled={scaled} />
      <ChartArt box={element.box} chart={element.chart} described scaled={scaled} />
      {text === null ? null : (
        <div ref={layer} style={textLayer(element.box, text, scaled)}>
          <SheetText look={textLook(text, scaled)} text={text} />
        </div>
      )}
    </div>
  )
}

function reach(element: CanvasElement, id: ElementId, name: string, moves: Moves, typing: boolean) {
  return {
    role: "group",
    "aria-label": name,
    "aria-description": `${canDrag(element) ? "Arrow keys move. Alt and Shift with the arrow keys resize. " : ""}${element.editable ? "Enter edits the text. " : ""}Delete removes it.`,
    tabIndex: canMove(element) && !typing ? 0 : -1,
    onPointerDown: (event: PointerEvent<HTMLElement>) => moves.press(event, element, "move"),
    onDoubleClick: (event: MouseEvent<HTMLElement>) => moves.doubleClick(event, element),
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
      const text = textKeyOf(event)
      if (text === null) {
        moves?.key(event, element)
        return
      }
      event.preventDefault()
      runTextKey(formatting, text)
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
  const hung = base["--bullet"] !== "none" && (paragraph.indent ?? 0) < 0
  return {
    ...base,
    ...(hung ? { textIndent: 0 } : {}),
    "--bullet": "none",
    margin: 0,
  } as CSSProperties
}

function sameSize(left: PaintBox | null, right: PaintBox | null): boolean {
  if (left === null || right === null) return left === right
  return (
    left.width === right.width &&
    left.height === right.height &&
    left.rotation === right.rotation &&
    left.flipH === right.flipH &&
    left.flipV === right.flipV
  )
}

function samePaint(left: CanvasElement, right: CanvasElement): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)] as (keyof CanvasElement)[])
  for (const key of keys) {
    if (key === "box" ? !sameSize(left.box, right.box) : left[key] !== right[key]) return false
  }
  return true
}

function useHeldInPlace(element: CanvasElement): CanvasElement {
  const held = useRef(element)
  if (!samePaint(held.current, element)) held.current = element
  return held.current
}

const LayerArt = memo(function LayerArt(props: {
  readonly store: PaintStore
  readonly element: CanvasElement
  readonly id: ElementId
  readonly scaled: Scaled
  readonly layer: RefObject<HTMLDivElement | null>
  readonly grab: boolean
  readonly unshown: boolean
  readonly framed: boolean
  readonly prompt: string | undefined
  readonly formatting: TextFormatting | undefined
  readonly onEdit: ((id: ElementId, value: string, kind: TextEditKind) => void) | undefined
}) {
  const { element, formatting, id, layer, onEdit, prompt, scaled, store, unshown } = props
  const text = element.text ?? noText
  const look = useMemo(() => textLook(text, scaled), [text, scaled])
  return (
    <>
      <FillLayers element={element} scaled={scaled} unshown={unshown || paintsFillAsSvg(element, scaled)} />
      <ShapeArt element={element} grab={props.grab} scaled={scaled} />
      <UnshownLabel box={element.box} scaled={scaled} text={element.unshownText} />
      <DiagramArt element={element} scaled={scaled} />
      <ChartArt box={element.box} chart={element.chart} described scaled={scaled} />
      <div ref={layer} style={textLayer(element.box, text, scaled)}>
        {prompt === undefined ? null : (
          <div
            aria-hidden="true"
            data-placeholder-prompt={prompt}
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
                whiteSpace: "pre-line",
              }}
            >
              {prompt}
            </div>
          </div>
        )}
        {onEdit === undefined ? (
          <Passage id={id} look={look} prompt={prompt} store={store} />
        ) : (
          <Passage
            formatting={formatting}
            framed={props.framed}
            id={id}
            look={look}
            onEdit={(value, kind) => onEdit(id, value, kind)}
            prompt={prompt}
            store={store}
          />
        )}
      </div>
    </>
  )
})

function PlacedText(props: {
  readonly store: PaintStore
  readonly element: CanvasElement
  readonly id: ElementId
  readonly scaled: Scaled
  readonly onEdit?: ((id: ElementId, value: string, kind: TextEditKind) => void) | undefined
  readonly onFit?: ((id: ElementId, height: number) => void) | undefined
  readonly moves: Moves | null
  readonly unshown: boolean
  readonly drawnWhenBlank: boolean
  readonly fallbackName: string
  readonly formatting: TextFormatting | undefined
  readonly targets: Targets | undefined
}) {
  const { drawnWhenBlank, fallbackName, formatting, id, moves, onEdit, scaled, store, unshown } = props
  const record = useElement(store, id)
  const shown = record?.text ?? ""
  const placed = usePlaced(store, props.element, id, props.targets)
  const { element, layer } = useTextFit(placed, scaled, shown)
  useFitReport(layer, placed, scaled, (height) => props.onFit?.(id, height))
  const painted = useHeldInPlace(element)
  const empty = useMemo(() => isBlank(shown), [shown])
  const fallback = element.label ?? (element.kind === "picture" ? fallbackName : (element.prompt ?? fallbackName))
  const name = useMemo(() => nameOf(shown, fallback), [shown, fallback])
  const typing = element.editable && onEdit !== undefined
  const isSelected = moves !== null && leadOf(moves.selection) === id
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
        ...elementFrame(element, scaled, takesPointer(element, empty, moves !== null, drawnWhenBlank), unshown),
        ...promptOutline,
        ...(moves === null || typing || !grabbed(element) ? {} : { cursor: "move", touchAction: "none" }),
      }}
      {...(moves === null ? {} : reach(element, id, name, moves, typing))}
      {...(typing ? formatReach(formatting, id, moves, element) : {})}
    >
      <LayerArt
        element={painted}
        formatting={formatting}
        framed={moves !== null}
        grab={moves !== null && grabbed(element)}
        id={id}
        layer={layer}
        onEdit={typing ? onEdit : undefined}
        prompt={showPrompt ? (element.prompt ?? undefined) : undefined}
        scaled={scaled}
        store={store}
        unshown={unshown}
      />
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
  const {
    drawnWhenBlank,
    element,
    fallbackName,
    formatting,
    moves,
    onEdit,
    onFit,
    quiet,
    scaled,
    store,
    targets,
    unshown,
  } = props
  if (quiet) return <QuietElement element={element} scaled={scaled} store={store} targets={targets} unshown={unshown} />
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
      onFit={onFit}
      scaled={scaled}
      store={store}
      targets={targets}
      unshown={unshown}
    />
  )
}
