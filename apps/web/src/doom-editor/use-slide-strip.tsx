import * as doom from "@airdesign/doom"
import { gestureFor } from "@airdesign/render"
import { useRef, type KeyboardEvent } from "react"
import { doomEditorCopy } from "@/copy/doom-editor-copy"
import { slideListCopy } from "@/copy/slide-list-copy"
import { slideThumbWidth, type SlideStrip } from "@/editor/slide-sidebar"
import { DoomThumb } from "./doom-thumb"
import {
  addSlideWrites,
  deleteSlideWrites,
  duplicateSlideWrites,
  moveSlideWrites,
  neighbourAfterDelete,
} from "./slide-writes"
import type { EditorClient } from "./use-doom-deck"

const layouts = doom.slideStarts.map((part) => ({ part, name: doomEditorCopy.slideStarts[part] }))
const isStart = (part: string): part is doom.SlideStart => (doom.slideStarts as readonly string[]).includes(part)

export function useSlideStrip(props: {
  readonly view: doom.Doom
  readonly client: EditorClient
  readonly slides: readonly doom.NodeId[]
  readonly current: doom.NodeId | undefined
  readonly onCurrent: (slide: doom.NodeId) => void
  readonly assetUrl: (asset: string) => string | undefined
}): SlideStrip {
  const { view, client, slides, current, onCurrent, assetUrl } = props
  const say = useRef<(text: string) => void>(() => undefined)
  const { size } = doom.deckOf(view)
  const index = current === undefined ? 0 : Math.max(0, slides.indexOf(current))
  const mint = () => client.mint()
  return {
    count: slides.length,
    current: index,
    layouts,
    say,
    thumbHeight: Math.round((slideThumbWidth * size.h) / size.w),
    thumb: (at, width) => {
      const slide = slides[at]
      return slide === undefined ? null : <DoomThumb view={view} slide={slide} width={width} assetUrl={assetUrl} />
    },
    onSelect: (at) => {
      const slide = slides[at]
      if (slide !== undefined) onCurrent(slide)
    },
    onAdd: (part, after) => {
      const from = after === undefined ? current : slides[after]
      const made = addSlideWrites(view, from ?? null, mint, part !== undefined && isStart(part) ? part : "titleOnly")
      client.push(made.writes)
      onCurrent(made.slide)
      say.current(slideListCopy.added((from === undefined ? slides.length : slides.indexOf(from)) + 2))
    },
    onClone: (at) => {
      const slide = slides[at]
      if (slide === undefined) return
      const made = duplicateSlideWrites(view, slide, mint)
      client.push(made.writes)
      onCurrent(made.slide)
    },
    onRemove: (at) => {
      const slide = slides[at]
      if (slide === undefined) return
      const writes = deleteSlideWrites(view, slide)
      if (writes.length === 0) {
        say.current(slideListCopy.lastSlide)
        return
      }
      const next = neighbourAfterDelete(view, slide)
      client.push(writes)
      if (next !== null) onCurrent(next)
    },
    onMove: (from, to) => {
      const slide = slides[from]
      if (slide === undefined) return
      const writes = moveSlideWrites(view, slide, to)
      if (writes.length > 0) client.push(writes)
      onCurrent(slide)
    },
  }
}

export function addAfterKey(event: KeyboardEvent, strip: SlideStrip): void {
  if (gestureFor(event.nativeEvent, "slides") !== "slide-add") return
  const entry = (event.target as HTMLElement).closest("[data-slide-entry]")?.getAttribute("data-slide-entry")
  if (entry === null || entry === undefined) return
  event.preventDefault()
  event.stopPropagation()
  strip.onAdd?.(undefined, Number(entry) - 1)
}
