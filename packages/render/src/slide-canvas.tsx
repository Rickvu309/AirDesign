import { memo, useLayoutEffect, useRef } from "react"
import type { Box, ElementId, StackMove, TableChange } from "@airdesign/document"
import { ConnectorEnds, type EndDrop } from "./connector-ends.js"
import type { End } from "./connector-drag.js"
import { targetsOf } from "./connector-follow.js"
import { PaintedElement } from "./element-kind.js"
import { GroupEffects, layered } from "./group-effects.js"
import type { HeldKeys } from "./held-keys.js"
import { changeSaid, namedFrames, shownPart, type Named } from "./element-said.js"
import { ChosenFrame, SelectionFrame } from "./selection-frame.js"
import { slideBackground } from "./slide-background.js"
import { canDrag, enterElement, useMoves } from "./slide-moves.js"
import { leadOf, type Selection } from "./selection.js"
import type { CanvasSlide } from "./record.js"
import type { TableBar } from "./table-paint.js"
import type { PaintStore } from "./store.js"
import type { TextEditKind } from "./passage.js"
import { ensureTextRule, type Scaled } from "./text-look.js"
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

export type Entering = { readonly id: ElementId; readonly keys?: HeldKeys }

export const SlideCanvas = memo(function SlideCanvas(props: {
  readonly store: PaintStore
  readonly slide: CanvasSlide
  readonly width: number
  readonly className?: string
  readonly quiet?: boolean
  readonly onEdit?: (id: ElementId, value: string, kind: TextEditKind) => void
  readonly onBox?: (id: ElementId, box: Box) => void
  readonly onRemove?: (ids: readonly ElementId[]) => void
  readonly onOrder?: (id: ElementId, move: StackMove) => void
  readonly selection?: Selection
  readonly onSelection?: (selection: Selection) => void
  readonly onGroup?: (ids: readonly ElementId[]) => void
  readonly onUngroup?: (id: ElementId) => void
  readonly onConnect?: (id: ElementId, end: End, to: EndDrop) => void
  readonly notice?: string
  readonly onTable?: (id: ElementId, change: TableChange) => void
  readonly tableBar?: TableBar
  readonly entering?: Entering | null
  readonly formatting?: TextFormatting
  readonly slideName?: string
}) {
  const { slide, width } = props
  const quiet = props.quiet === true
  const scaled: Scaled = (emu) => (emu * width) / slide.width
  useLayoutEffect(() => {
    ensureTextRule(document)
  }, [])
  const picking = {
    ...(props.selection === undefined ? {} : { selection: props.selection }),
    ...(props.onSelection === undefined ? {} : { onSelection: props.onSelection }),
  }
  const moves = useMoves(props.store, slide, width, props.onBox, props.onRemove, props.onOrder, picking, {
    ...(props.onGroup === undefined ? {} : { onGroup: props.onGroup }),
    ...(props.onUngroup === undefined ? {} : { onUngroup: props.onUngroup }),
  })
  const moving = props.onBox === undefined ? null : moves
  const lead = moving === null ? null : leadOf(moving.selection)
  const selected = lead === null ? undefined : slide.elements.find((each) => each.id === lead)
  const onConnect = selected?.kind === "connector" ? props.onConnect : undefined
  const surface = useRef<HTMLDivElement>(null)
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
  useLayoutEffect(() => {
    const host = surface.current
    if (entering?.id === undefined || entering.id === null || host === null || entered.current === entering.id) return
    entered.current = entering.id
    enterElement(host, entering, keys?.take() ?? "")
  }, [entering, keys])
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
      {layered(
        slide.elements,
        (element) => (
          <PaintedElement
            key={element.key}
            element={element}
            slideHeight={slide.height}
            formatting={props.formatting}
            moves={moving}
            onEdit={props.onEdit}
            onTable={props.onTable}
            tableBar={props.tableBar}
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
      {moving === null
        ? null
        : slide.elements.flatMap((each) =>
            each.id === null || each.id === lead || !moving.selection.ids.includes(each.id)
              ? []
              : [<ChosenFrame key={each.key} id={each.id} element={each} scaled={scaled} store={props.store} />],
          )}
      {moving === null || selected === undefined || selected.id === null ? null : (
        <SelectionFrame
          element={selected}
          id={selected.id}
          movable={canDrag(selected)}
          onPress={(event, grip) => moving.press(event, selected, grip)}
          resizable={canDrag(selected) && onConnect === undefined}
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
    </div>
  )
})
