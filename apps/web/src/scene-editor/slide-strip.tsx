import type { scene } from "@airdesign/document"
import { gestureFor } from "@airdesign/render"
import { useCallback, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react"
import { Announcer, type Announcement } from "@/components/ui/announcer"
import { Button } from "@/components/ui/button"
import { slideListCopy } from "@/copy/slide-list-copy"
import { EditorIcon } from "@/editor/editor-icons"
import { hairlineShadow, surfaceShadow } from "@/editor/editor-chrome"
import { SlideItem } from "@/editor/slide-list-item"
import { cn } from "@/lib/class-names"
import { SceneThumb } from "./scene-thumb"
import {
  addSlideWrites,
  deleteSlideWrites,
  duplicateSlideWrites,
  moveSlideWrites,
  neighbourAfterDelete,
} from "./slide-writes"
import type { EditorClient } from "./use-scene-deck"

const thumbWidth = 197
const thumbCard = cn("block shrink-0 overflow-hidden rounded-[2px] bg-white", hairlineShadow)

export function SlideStrip(props: {
  readonly view: scene.Scene
  readonly client: EditorClient
  readonly slides: readonly scene.NodeId[]
  readonly current: scene.NodeId | undefined
  readonly onCurrent: (slide: scene.NodeId) => void
}) {
  const { view, client, slides, current, onCurrent } = props
  const list = useRef<HTMLDivElement>(null)
  const following = useRef(false)
  const [message, setMessage] = useState<Announcement | null>(null)
  const announce = useCallback(
    (text: string) => setMessage((held) => ({ text, odd: held === null ? false : !held.odd })),
    [],
  )
  const index = current === undefined ? -1 : slides.indexOf(current)

  useLayoutEffect(() => {
    const entry = list.current?.querySelector<HTMLElement>(`[data-slide-entry="${String(index + 1)}"]`)
    if (entry === null || entry === undefined) return
    if (following.current) {
      following.current = false
      entry.focus()
    }
    entry.scrollIntoView({ block: "nearest" })
  }, [index, slides.length])

  const mint = () => client.mint()

  function add(after: scene.NodeId | null) {
    following.current = true
    const made = addSlideWrites(view, after, mint)
    client.push(made.writes)
    onCurrent(made.slide)
    announce(slideListCopy.added((after === null ? -1 : slides.indexOf(after)) + 2))
  }

  function duplicate(at: number) {
    const slide = slides[at]
    if (slide === undefined) return
    following.current = true
    const made = duplicateSlideWrites(view, slide, mint)
    client.push(made.writes)
    onCurrent(made.slide)
    announce(slideListCopy.duplicated(at + 1))
  }

  function remove(at: number) {
    const slide = slides[at]
    if (slide === undefined) return
    const writes = deleteSlideWrites(view, slide)
    if (writes.length === 0) {
      announce(slideListCopy.lastSlide)
      return
    }
    following.current = true
    const next = neighbourAfterDelete(view, slide)
    client.push(writes)
    if (next !== null) onCurrent(next)
    announce(slideListCopy.deleted(at + 1))
  }

  function move(from: number, to: number) {
    const slide = slides[from]
    if (slide === undefined || to < 0 || to >= slides.length) return
    const writes = moveSlideWrites(view, slide, to)
    if (writes.length === 0) return
    following.current = true
    client.push(writes)
    announce(slideListCopy.moved(from + 1, to + 1))
  }

  function step(to: number) {
    const target = slides[to]
    if (target === undefined) return
    following.current = true
    onCurrent(target)
  }

  function onKeyDown(at: number, event: KeyboardEvent<HTMLButtonElement>) {
    const gesture = gestureFor(event.nativeEvent, "slides")
    if (gesture === null) return
    const action =
      gesture === "slide-add"
        ? () => add(slides[at] ?? null)
        : gesture === "slide-duplicate"
          ? () => duplicate(at)
          : gesture === "slide-delete"
            ? () => remove(at)
            : gesture === "slide-up"
              ? () => move(at, at - 1)
              : gesture === "slide-down"
                ? () => move(at, at + 1)
                : gesture === "slide-previous"
                  ? () => step(at - 1)
                  : gesture === "slide-next"
                    ? () => step(at + 1)
                    : null
    if (action === null) return
    event.preventDefault()
    event.stopPropagation()
    action()
  }

  function onDrop(at: number, event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    const from = Number(event.dataTransfer.getData("text/plain"))
    if (Number.isInteger(from) && from !== at) move(from, at)
  }

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white" data-editor-sidebar>
      <div className="px-3 pt-3 pb-2">
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-7 w-full gap-1 rounded-lg bg-white text-[length:var(--type-dense)] text-foreground hover:bg-black/4 active:translate-y-0",
            surfaceShadow,
          )}
          aria-label={slideListCopy.addSlide}
          onClick={() => add(current ?? null)}
        >
          {slideListCopy.newSlide}
          <EditorIcon name="plus" size={15} />
        </Button>
      </div>
      <Announcer message={message} />
      <div
        ref={list}
        role="group"
        aria-label={slideListCopy.listName}
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-1.5 py-1"
        data-slide-list
      >
        {slides.map((slide, at) => (
          <SlideItem
            key={slide}
            index={at + 1}
            count={slides.length}
            active={slide === current}
            reachable={slide === current}
            onSelect={() => onCurrent(slide)}
            onKeyDown={(event) => onKeyDown(at, event)}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", String(at))
              event.dataTransfer.effectAllowed = "move"
              onCurrent(slide)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDrop(at, event)}
          >
            <SceneThumb view={view} slide={slide} width={thumbWidth} className={thumbCard} />
          </SlideItem>
        ))}
      </div>
    </aside>
  )
}
