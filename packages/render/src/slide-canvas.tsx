import { memo, useLayoutEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react"
import type { ElementId, StackMove } from "@airdesign/document"
import type { Moved } from "./box-gesture.js"
import { ConnectorEnds, type EndDrop } from "./connector-ends.js"
import type { End } from "./connector-drag.js"
import { targetsOf } from "./connector-follow.js"
import { PaintedElement } from "./element-kind.js"
import { GroupEffects, layered } from "./group-effects.js"
import type { HeldKeys } from "./held-keys.js"
import { changeSaid, namedFrames, shownPart, type Named } from "./element-said.js"
import { AroundFrame, ChosenFrame, SelectionFrame } from "./selection-frame.js"
import { slideBackground } from "./slide-background.js"
import { GuideLayer } from "./guide-layer.js"
import { useMeasuring } from "./measuring.js"
import { canDrag, enterElement, useMoves } from "./slide-moves.js"
import { leadOf, type Selection } from "./selection.js"
import type { CanvasElement, CanvasSlide } from "./record.js"
import type { PaintStore } from "./store.js"
import type { TextEditKind } from "./passage.js"
import { ensureTextRule, type Scaled } from "./text-look.js"
import type { TextFormatting } from "./text-formatting.js"
import { useHoverOutline } from "./use-hover-outline.js"
import { useSlideMarquee, type OwnsKey } from "./use-slide-marquee.js"

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

export type Entering = { readonly id: ElementId; readonly keys?: HeldKeys }

export const SlideCanvas = memo(function SlideCanvas(props: {
  readonly store: PaintStore
  readonly slide: CanvasSlide
  readonly width: number
  readonly className?: string
  readonly quiet?: boolean
  readonly measuring?: boolean
  readonly highlights?: readonly ElementId[]
  readonly onEdit?: (id: ElementId, value: string, kind: TextEditKind) => void
  readonly onFit?: (id: ElementId, height: number) => void
  readonly onBoxes?: (moved: readonly Moved[]) => void
  readonly onRemove?: (ids: readonly ElementId[]) => void
  readonly onOrder?: (id: ElementId, move: StackMove) => void
  readonly selection?: Selection
  readonly onSelection?: (selection: Selection) => void
  readonly onGroup?: (ids: readonly ElementId[]) => void
  readonly onUngroup?: (id: ElementId) => void
  readonly onFrame?: (ids: readonly ElementId[]) => void
  readonly onConnect?: (id: ElementId, end: End, to: EndDrop) => void
  readonly notice?: string
  readonly entering?: Entering | null
  readonly formatting?: TextFormatting
  readonly slideName?: string
  readonly ownsKey?: OwnsKey
}) {
  const { slide, width } = props
  const quiet = props.quiet === true
  const scaled: Scaled = (emu) => (emu * width) / slide.width
  useLayoutEffect(() => {
    ensureTextRule(document)
  }, [])
  const surface = useRef<HTMLDivElement>(null)
  const startMarquee = useRef<((event: ReactPointerEvent<HTMLElement>, fallback?: CanvasElement) => void) | null>(null)
  const hideHover = useRef<(() => void) | null>(null)
  const picking = {
    ...(props.selection === undefined ? {} : { selection: props.selection }),
    ...(props.onSelection === undefined ? {} : { onSelection: props.onSelection }),
    ...(props.ownsKey === undefined ? {} : { ownsKey: props.ownsKey }),
    onEmptyPress: (event: ReactPointerEvent<HTMLDivElement>) => startMarquee.current?.(event),
    onBackdropMarquee: (event: ReactPointerEvent<HTMLElement>, owner: CanvasElement) =>
      startMarquee.current?.(event, owner),
    onDragChange: (dragging: boolean) => {
      if (dragging) hideHover.current?.()
    },
  }
  const moves = useMoves(props.store, slide, width, props.onBoxes, props.onRemove, props.onOrder, picking, {
    ...(props.onGroup === undefined ? {} : { onGroup: props.onGroup }),
    ...(props.onUngroup === undefined ? {} : { onUngroup: props.onUngroup }),
    ...(props.onFrame === undefined ? {} : { onFrame: props.onFrame }),
  })
  const moving = props.onBoxes === undefined ? null : moves
  const marquee = useSlideMarquee({
    surface,
    enabled: moving !== null,
    slide,
    width,
    store: props.store,
    selection: moves.latest,
    choose: moves.choose,
    isDragging: moves.isDragging,
    ownsKey: props.ownsKey,
    onActiveChange: (active) => {
      if (active) hideHover.current?.()
    },
  })
  startMarquee.current = marquee.start
  const hover = useHoverOutline({
    surface,
    enabled: moving !== null,
    slide,
    width,
    scaled,
    store: props.store,
    selection: moves.selection,
    isBusy: () => moves.isDragging() || marquee.isActive(),
  })
  hideHover.current = hover.hide
  const ids = moving?.selection.ids
  const many = useMemo(
    () =>
      ids === undefined || ids.length < 2
        ? []
        : slide.elements.filter((each) => each.id !== null && ids.includes(each.id)),
    [ids, slide.elements],
  )
  const lead = moving === null || many.length > 0 ? null : leadOf(moving.selection)
  const selected = lead === null ? undefined : slide.elements.find((each) => each.id === lead)
  const onConnect = selected?.kind === "connector" ? props.onConnect : undefined
  useMeasuring(surface, slide, props.store, ids, moving?.guides)
  const entered = useRef<ElementId | null>(null)
  const keys = props.entering?.keys
  const entering = slide.elements.find((each) => each.id !== null && each.id === props.entering?.id)
  const named = useRef<{ frames: Named; part: string | null }>({ frames: new Map(), part: null })
  const say = moving?.say
  useLayoutEffect(() => {
    const host = surface.current
    if (host === null || say === undefined) return
    const frames = namedFrames(host)
    const shown = slide.part ?? null
    const said = changeSaid(named.current.frames, frames, named.current.part, shown, props.slideName ?? null)
    named.current = { frames, part: shown ?? shownPart(frames, named.current.part) }
    if (said !== null) say(said)
  }, [slide, slide.part, say, props.slideName])
  function enterPainted() {
    const host = surface.current
    if (entering?.id === undefined || entering.id === null || host === null || entered.current === entering.id) return
    if (host.querySelector(`[data-canvas-element="${entering.key}"]`) === null) return
    entered.current = entering.id
    enterElement(host, entering, keys?.take() ?? "")
  }
  useLayoutEffect(enterPainted, [entering, keys])
  const tileScale = { "--tile-slide-scale": scaled(9525) }
  return (
    <div
      ref={surface}
      {...(quiet
        ? { "data-thumb-paint": true }
        : props.measuring === true
          ? { "data-measure-paint": true }
          : { "data-slide-paint": true })}
      className={props.className}
      style={{
        ...tileScale,
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
      {layered(
        slide.elements,
        (element) => (
          <PaintedElement
            key={element.key}
            onPaint={element === entering ? enterPainted : undefined}
            element={element}
            slideHeight={slide.height}
            formatting={props.formatting}
            moves={moving}
            onEdit={props.onEdit}
            onFit={props.onFit}
            quiet={quiet}
            scaled={scaled}
            store={props.store}
            targets={targetsOf(slide.elements, element)}
          />
        ),
        (group, members) => (
          <GroupEffects key={`${group.key} effects`} element={group} scaled={scaled}>
            {members}
          </GroupEffects>
        ),
      )}
      {moving === null ? null : (
        <div role="status" aria-live="polite" aria-atomic="true" style={visuallyHidden}>
          {props.notice !== undefined && props.notice !== "" ? props.notice : moving.message}
        </div>
      )}
      {moving === null ? null : (
        <div
          ref={hover.mark}
          hidden
          aria-hidden="true"
          data-hover-outline=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 9,
            pointerEvents: "none",
            boxShadow: "0 0 0 var(--layer-hover-width) var(--layer-hover-edge)",
          }}
        />
      )}
      {props.highlights === undefined
        ? null
        : slide.elements.map((each) =>
            each.id !== null && props.highlights?.includes(each.id) ? (
              <ChosenFrame key={each.key} id={each.id} element={each} scaled={scaled} store={props.store} />
            ) : null,
          )}
      {many.flatMap((each) =>
        each.id === null
          ? []
          : [<ChosenFrame key={each.key} id={each.id} element={each} scaled={scaled} store={props.store} />],
      )}
      {moving === null || many.length === 0 ? null : (
        <AroundFrame
          elements={many}
          onPress={(event) => {
            const pressed = many.find((each) => each.id === leadOf(moving.selection)) ?? many[0]
            if (pressed !== undefined) moving.press(event, pressed, "move")
          }}
          scaled={scaled}
          store={props.store}
        />
      )}
      {moving === null || selected === undefined || selected.id === null ? null : (
        <SelectionFrame
          element={selected}
          id={selected.id}
          movable={canDrag(selected)}
          onPress={(event, grip) => moving.press(event, selected, grip)}
          resizable={
            canDrag(selected) && onConnect === undefined && selected.frame !== "auto" && selected.inFrame !== "auto"
          }
          scaled={scaled}
          store={props.store}
        />
      )}
      {selected?.id === undefined || selected.id === null || onConnect === undefined ? null : (
        <ConnectorEnds
          element={selected}
          id={selected.id}
          onConnect={onConnect}
          scaled={scaled}
          slide={slide}
          store={props.store}
          width={width}
        />
      )}
      {moving === null ? null : <GuideLayer board={moving.guides} scaled={scaled} />}
      {moving === null ? null : (
        <div
          ref={marquee.mark}
          hidden
          aria-hidden="true"
          data-slide-marquee=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 10,
            pointerEvents: "none",
            boxSizing: "border-box",
            border: "var(--slide-marquee-width) solid var(--slide-marquee-edge)",
            background: "var(--slide-marquee-fill)",
          }}
        />
      )}
    </div>
  )
})
