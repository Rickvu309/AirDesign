import { SlideItem } from "@/editor/slide-list-item"
import { Filmstrip } from "@airdesign/render"
import { gestureFor } from "@/lib/gestures"
import type { NodeId } from "@airdesign/doom"
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { Announcer, type Announcement } from "@/components/ui/announcer"
import { Button } from "@/components/ui/button"
import { slideListCopy } from "@/copy/slide-list-copy"
import { EditorIcon } from "@/components/ui/editor-icons"
import { hairlineShadow, surfaceShadow } from "@/components/ui/shadows"
import { SidebarHead } from "@/editor/editor-chrome"
import { slideKey, type SlideKey } from "@/editor/slide-keys"
import type { SaveStatus } from "@/editor/save-status"
import { slideChangeAllowed } from "@/editor/slide-menu"
import { NewSlideMenu } from "@/editor/new-slide-menu"
import type { LayoutChoice } from "@/editing/slide-layout"
import { cn } from "@/lib/class-names"
import { setDropPlace } from "@/editor/slide-list-pick"
import { useSlideListSet } from "@/editor/use-slide-list-set"

export const slideThumbWidth = 197

const thumbWidth = slideThumbWidth

const thumbCard = cn("block shrink-0 overflow-hidden rounded-[2px] bg-white", hairlineShadow)

export type SetChange = { readonly picked: readonly string[]; readonly order: readonly string[] }

export type SlideStrip = {
  readonly count: number
  readonly slideIds: readonly NodeId[]
  readonly current: number
  readonly skipped?: readonly boolean[]
  readonly onSkip?: (indices: readonly number[], skipped: boolean) => void
  readonly onSelection?: (indices: readonly number[]) => void
  readonly onSelect: (index: number) => void
  readonly onAdd?: (layoutPart?: string, after?: number) => void
  readonly layouts?: readonly LayoutChoice[]
  readonly onClone?: (index: number) => void
  readonly onRemove?: (index: number) => void
  readonly onChangeSet?: (change: "clone" | "remove", indices: readonly number[]) => SetChange | null
  readonly onMoveMany?: (held: readonly number[], at: number) => void
  readonly onMove?: (from: number, to: number) => void
  readonly say?: { current: (text: string) => void }
  readonly thumbHeight: number
  readonly thumb: (index: number, width: number) => ReactNode
}

export function useSlideSay(say: SlideStrip["say"], announce: (text: string) => void) {
  useLayoutEffect(() => {
    if (say === undefined) return
    say.current = announce
    return () => {
      say.current = () => undefined
    }
  }, [say, announce])
}

export function SlideSidebar({
  title,
  strip,
  onRename,
  onTrash,
  onGrid,
  save = null,
  layers = null,
  onSlideSelection,
}: {
  title: string
  strip: SlideStrip
  onTrash?: () => void
  onRename?: (name: string) => void
  onGrid?: () => void
  save?: SaveStatus | null
  layers?: ReactNode
  onSlideSelection?: (count: number) => void
}) {
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white" data-editor-sidebar>
      <SidebarHead
        title={title}
        homeHref="/"
        save={save}
        {...(onGrid === undefined ? { gridOff: true } : { onGrid })}
        {...(onRename === undefined ? {} : { onRename })}
        {...(onTrash === undefined ? {} : { onTrash })}
      />
      <DeckStrip strip={strip} onSlideSelection={onSlideSelection} />
      {layers}
    </aside>
  )
}

const stops = "[data-slide-item]"

function stopsOf(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>(stops)]
}

function rovedTo(key: string, count: number, at: number): number {
  if (key === "ArrowDown") return Math.min(at + 1, count - 1)
  if (key === "ArrowUp") return Math.max(at - 1, 0)
  return key === "Home" ? 0 : count - 1
}

function movesWithHistory(event: KeyboardEvent): boolean {
  const gesture = gestureFor(event.nativeEvent, "editor")
  return gesture === "undo" || gesture === "redo"
}

function onListKey(event: KeyboardEvent<HTMLDivElement>, strip: SlideStrip, drop: () => void) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
  const all = stopsOf(event.currentTarget)
  const at = all.findIndex((each) => each === document.activeElement)
  if (at === -1) return
  event.preventDefault()
  drop()
  const target = all[rovedTo(event.key, all.length, at)]
  target?.focus()
  const entry = target?.getAttribute("data-slide-entry")
  if (entry !== null && entry !== undefined) strip.onSelect(Number(entry) - 1)
}

function DeckStrip({
  strip,
  onSlideSelection,
}: {
  strip: SlideStrip
  onSlideSelection: ((count: number) => void) | undefined
}) {
  const list = useRef<HTMLDivElement>(null)
  const following = useRef(false)
  const { current, count } = strip
  const canAdd = count > 0 && strip.onAdd !== undefined
  useLayoutEffect(() => {
    if (!following.current) return
    const next = list.current?.querySelector<HTMLElement>(`[data-slide-entry="${current + 1}"]`)
    if (next === null || next === undefined) return
    following.current = false
    if (next !== document.activeElement) next.focus()
  }, [current, count])
  const [stop, setStop] = useState<string | null>(null)
  const [message, setMessage] = useState<Announcement | null>(null)
  const announce = useCallback(
    (text: string) => setMessage((held) => ({ text, odd: held === null ? false : !held.odd })),
    [],
  )
  useSlideSay(strip.say, announce)
  const { held, press, moveSlides, inSet, setChange, menuSet, drop } = useSlideListSet(strip, {
    following,
    list,
    announce,
    onSlideSelection,
  })
  const item = (index: number) => (
    <SlideItem
      key={index}
      index={index + 1}
      count={strip.count}
      active={index === strip.current}
      picked={inSet(index)}
      menuSet={inSet(index) ? menuSet : undefined}
      skipped={strip.skipped?.[index] === true}
      onSkip={
        strip.onSkip === undefined ? undefined : (skipped) => strip.onSkip?.(inSet(index) ? held : [index], skipped)
      }
      reachable={reachable === `slide:${String(index)}`}
      onSelect={(how) => press(index, how)}
      onKeyDown={(event) => onSlideKey(strip, index, event, announce, setChange(index))}
      onChoose={(change) => {
        following.current = true
        const onSet = setChange(index)
        if (onSet === null) runSlideChange(strip, index, change, announce)
        else onSet(change)
      }}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", String(index))
        event.dataTransfer.effectAllowed = "move"
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const from = Number(event.dataTransfer.getData("text/plain"))
        if (!Number.isInteger(from) || from === index) return
        if (inSet(from) && strip.onMoveMany !== undefined) {
          const at = setDropPlace(held, index)
          if (at !== null) moveSlides(held, at)
          return
        }
        announce(slideListCopy.moved(from + 1, index + 1))
        strip.onMove?.(from, index)
      }}
    >
      <Filmstrip
        className={thumbCard}
        height={strip.thumbHeight}
        paint={() => strip.thumb(index, thumbWidth)}
        width={thumbWidth}
      />
    </SlideItem>
  )
  const present = (key: string) => {
    const at = Number(key.split(":")[1])
    return at >= 0 && at < strip.count
  }
  const reachable = stop !== null && present(stop) ? stop : `slide:${String(strip.current)}`
  return (
    <>
      <div className="flex px-3 pb-2">
        <div className={cn("flex h-7 flex-1 items-center rounded-lg bg-white", surfaceShadow)}>
          <NewSlideMenu
            layouts={canAdd ? (strip.layouts ?? []) : []}
            onChoose={(part) => {
              strip.onAdd?.(part)
            }}
          />
          <span className="block h-7 w-px bg-[var(--field-edge)]" />
          <Button
            type="button"
            variant="ghost"
            className="h-7 w-8 rounded-l-none rounded-r-lg px-0 text-foreground hover:bg-black/4 active:translate-y-0"
            aria-label="Add slide"
            disabled={!canAdd}
            onClick={() => {
              following.current = true
              strip.onAdd?.()
            }}
          >
            <EditorIcon name="plus" size={15} />
          </Button>
        </div>
      </div>
      <Announcer message={message} />
      <div
        ref={list}
        role="group"
        aria-label={slideListCopy.listName}
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-1.5 py-1"
        data-slide-list
        onFocus={(event: FocusEvent<HTMLDivElement>) => {
          const key = event.target.getAttribute("data-stop")
          if (key !== null) setStop(key)
        }}
        onKeyDown={(event) => onListKey(event, strip, drop)}
        onKeyDownCapture={(event) => {
          if (slideKey(event) !== null || movesWithHistory(event)) following.current = true
        }}
        onDropCapture={() => {
          following.current = true
        }}
        onBlur={(event) => {
          if (event.relatedTarget !== null && !event.currentTarget.contains(event.relatedTarget))
            following.current = false
        }}
      >
        {Array.from({ length: strip.count }, (_, index) => item(index))}
      </div>
    </>
  )
}

function runSlideChange(strip: SlideStrip, index: number, change: SlideKey, announce: (text: string) => void): void {
  if (!slideChangeAllowed(change, index, strip.count)) return
  const number = index + 1
  if (change === "remove") {
    strip.onRemove?.(index)
    announce(slideListCopy.deleted(number))
  }
  if (change === "clone") {
    strip.onClone?.(index)
    announce(slideListCopy.duplicated(number))
  }
  if (change === "up") {
    strip.onMove?.(index, index - 1)
    announce(slideListCopy.moved(number, number - 1))
  }
  if (change === "down") {
    strip.onMove?.(index, index + 1)
    announce(slideListCopy.moved(number, number + 1))
  }
}

function onSlideKey(
  strip: SlideStrip,
  index: number,
  event: KeyboardEvent<HTMLButtonElement>,
  announce: (text: string) => void,
  onSet: ((change: SlideKey) => void) | null,
): void {
  const change = slideKey(event)
  if (change === null) return
  event.preventDefault()
  if (onSet === null) runSlideChange(strip, index, change, announce)
  else onSet(change)
}
