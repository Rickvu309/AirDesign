import * as doom from "@airdesign/doom"
import { gestureFor } from "@/lib/gestures"
import { slideNumber } from "@/lib/slide-numbering"
import { useRef, type KeyboardEvent } from "react"
import { toast } from "@/components/ui/toast"
import { editorCopy } from "@/copy/editor-copy"
import { slideListCopy } from "@/copy/slide-list-copy"
import { slideThumbWidth, type SlideStrip } from "@/editor/slide-sidebar"
import { TypedThumb, type TypingPreview } from "./typing-preview"
import {
  addSlideWrites,
  deleteSlideWrites,
  duplicateSlideWrites,
  moveSlideWrites,
  neighbourAfterDelete,
  slideGroupMoveWrites,
} from "./slide-writes"
import { skipSaid, skipWrites } from "./slide-skip"
import type { EditorClient } from "./use-deck"
import { useLayoutPictures } from "./use-layout-pictures"

const layouts = doom.slideStarts.map((part) => ({ part, name: editorCopy.slideStarts[part] }))
const isStart = (part: string): part is doom.SlideStart => (doom.slideStarts as readonly string[]).includes(part)

export function useSlideStrip(props: {
  readonly view: doom.Doom
  readonly typing: TypingPreview
  readonly client: EditorClient
  readonly slides: readonly doom.NodeId[]
  readonly current: doom.NodeId | undefined
  readonly onCurrent: (slide: doom.NodeId) => void
  readonly measure: doom.Measure | null
  readonly assetUrl: (asset: string) => string | undefined
}): SlideStrip {
  const { view, typing, client, slides, current, onCurrent, assetUrl } = props
  const layoutPictures = useLayoutPictures(view, current)
  const say = useRef<(text: string) => void>(() => undefined)
  const { size } = doom.deckOf(view)
  const index = current === undefined ? 0 : Math.max(0, slides.indexOf(current))
  const mint = () => client.mint()
  const pick = (held: readonly number[]) => held.flatMap((at) => slides[at] ?? [])
  const landed = (writes: readonly doom.Write[], options?: Parameters<EditorClient["push"]>[1]): boolean => {
    const pushed = client.push(writes, options)
    if (!pushed.ok && pushed.refused.refused === "limit") toast.refusal(slideListCopy.slideLimit(doom.limits.slides))
    return pushed.ok
  }
  const remove = (removed: readonly doom.NodeId[]): "removed" | "last-slide" | "refused" => {
    const writes = deleteSlideWrites(view, removed)
    if (writes.length === 0) return "refused"
    const next = neighbourAfterDelete(view, removed)
    const pushed = client.push(writes)
    if (!pushed.ok) return pushed.refused.refused === "last-slide" ? "last-slide" : "refused"
    if (next !== null) onCurrent(next)
    return "removed"
  }
  return {
    count: slides.length,
    slideIds: slides,
    current: index,
    layouts,
    layoutPictures,
    say,
    thumbHeight: Math.round((slideThumbWidth * size.h) / size.w),
    thumb: (at, width) => {
      const slide = slides[at]
      return slide === undefined ? null : (
        <TypedThumb typing={typing} view={view} slide={slide} width={width} assetUrl={assetUrl} />
      )
    },
    onSelect: (at) => {
      const slide = slides[at]
      if (slide !== undefined) onCurrent(slide)
    },
    onAdd: (part, after, side = "same") => {
      const from = after === undefined ? current : slides[after]
      const made = addSlideWrites(
        view,
        from ?? null,
        mint,
        part !== undefined && isStart(part) ? part : "titleOnly",
        props.measure ?? undefined,
        side,
      )
      if (!landed(made.writes, part === "chart" ? { read: view } : undefined)) return
      onCurrent(made.slide)
      const number = doom.slidesOf(client.view()).findIndex((each) => each.id === made.slide) + 1
      say.current(slideListCopy.added(number))
    },
    onClone: (at) => {
      const slide = slides[at]
      if (slide === undefined) return
      const made = duplicateSlideWrites(view, [slide], mint)
      const copy = made.slides[0]
      if (copy === undefined || !landed(made.writes)) return
      onCurrent(copy)
      say.current(slideListCopy.duplicated(at + 1))
    },
    onRemove: (at) => {
      const slide = slides[at]
      if (slide === undefined) return
      const removed = remove([slide])
      if (removed === "last-slide") say.current(slideListCopy.lastSlide)
      if (removed === "removed") say.current(slideListCopy.deleted(at + 1))
    },
    onMove: (from, to) => {
      const slide = slides[from]
      if (slide === undefined) return
      client.push(moveSlideWrites(view, [slide], to > from ? to + 1 : to, slides[to]))
      onCurrent(slide)
    },
    onMoveMany: (held, at) => {
      client.push(moveSlideWrites(view, pick(held), at))
    },
    onMoveGroups: (held, at, side) => {
      const writes = slideGroupMoveWrites(view, pick(held), at, side, mint)
      if (writes.length === 0 || !client.push(writes).ok) return false
      const first = pick(held)[0]
      if (side !== "keep" && first !== undefined) onCurrent(first)
      return true
    },
    skipped: slides.map((id) => doom.propOf(view.nodes.get(id), "skipped") === true),
    onSkip: (indices, skipping) => {
      const writes = skipWrites(view, slides, indices, skipping)
      if (writes.length === 0) return
      const pushed = client.push(writes)
      if (!pushed.ok || "unchanged" in pushed) return
      say.current(skipSaid(skipping, indices.length, slideNumber(indices[0] ?? 0)))
    },
    onChangeSet: (change, held) => {
      if (change === "remove") {
        const removed = remove(pick(held))
        if (removed === "last-slide") toast.refusal(slideListCopy.lastSlide)
        if (removed !== "removed") return null
        return { picked: [], order: doom.slidesOf(client.view()).map((each) => each.id) }
      }
      const made = duplicateSlideWrites(view, pick(held), mint)
      const copy = made.slides[0]
      if (copy === undefined || !client.push(made.writes).ok) return null
      onCurrent(copy)
      return { picked: made.slides, order: doom.slidesOf(client.view()).map((each) => each.id) }
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
