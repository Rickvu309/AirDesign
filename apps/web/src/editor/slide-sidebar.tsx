import { SlideItem } from "@/editor/slide-list-item"
import { Filmstrip } from "@airdesign/render"
import { gestureFor } from "@/lib/gestures"
import { slideNumber } from "@/lib/slide-numbering"
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
import { GridHead, Island, SidebarHead } from "@/editor/editor-chrome"
import { slideKey, type SlideKey } from "@/editor/slide-keys"
import type { SaveStatus } from "@/editor/save-status"
import { slideChangeAllowed } from "@/editor/slide-menu"
import { NewSlideMenu } from "@/editor/new-slide-menu"
import type { LayoutChoice } from "@/editing/slide-layout"
import type { LayoutPictureSource } from "@/editor/layout-pictures"
import { cn } from "@/lib/class-names"
import { setDropPlace } from "@/editor/slide-list-pick"
import { useSlideListSet } from "@/editor/use-slide-list-set"
import { gridStep } from "@/editor/slide-grid-step"
import { gridFitScale, gridGapAfter, gridGaps, gridGroups, gridLines, type GridSize } from "@/editor/slide-grid-layout"

export const slideThumbWidth = 197

const thumbWidth = slideThumbWidth

const gridBarRoom = 40

const gridCard = "block shrink-0 overflow-hidden rounded-[2px] bg-white"
const gridCardEdge = "shadow-[0px_0px_0px_1px_var(--line),0px_1px_3px_var(--black-8)]"
const gridCardPicked = "shadow-[0px_0px_0px_2px_var(--ring)]"

export type GridView = {
  readonly zoom: "fit" | number
  readonly onScale: (scale: number, fit: number) => void
  readonly onSlides: () => void
  readonly right?: ReactNode
  readonly bar?: ReactNode
}

type GridChrome = GridView & {
  readonly title: string
  readonly save: SaveStatus | null
  readonly onRename: ((name: string) => void) | undefined
  readonly onTrash: (() => void) | undefined
}

function useRoom(): [GridSize, (element: HTMLElement | null) => void] {
  const [room, setRoom] = useState<GridSize>({ width: 1200, height: 800 })
  const [element, setElement] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (element === null) return
    const measure = () =>
      setRoom((last) =>
        last.width === element.clientWidth && last.height === element.clientHeight
          ? last
          : { width: element.clientWidth, height: element.clientHeight },
      )
    measure()
    if (typeof ResizeObserver !== "function") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [room, setElement]
}

const thumbCard = cn("block shrink-0 overflow-hidden rounded-[2px] bg-white", hairlineShadow)

export type SetChange = { readonly picked: readonly string[]; readonly order: readonly string[] }

export type SlideStrip = {
  readonly count: number
  readonly slideIds: readonly NodeId[]
  readonly current: number
  readonly skipped?: readonly boolean[]
  readonly groupStarts?: readonly number[]
  readonly slideSize?: GridSize
  readonly onSkip?: (indices: readonly number[], skipped: boolean) => void
  readonly onSelection?: (indices: readonly number[]) => void
  readonly onSelect: (index: number) => void
  readonly onAdd?: (layoutPart?: string, after?: number) => void
  readonly layouts?: readonly LayoutChoice[]
  readonly layoutPictures?: LayoutPictureSource
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
  save = null,
  layers = null,
  onSlideSelection,
  grid,
  onGrid,
}: {
  title: string
  strip: SlideStrip
  onTrash?: () => void
  onRename?: (name: string) => void
  save?: SaveStatus | null
  layers?: ReactNode
  onSlideSelection?: (count: number) => void
  grid?: GridView | undefined
  onGrid?: () => void
}) {
  const inGrid = grid !== undefined
  const [seen, setSeen] = useState(inGrid)
  const [arrived, setArrived] = useState(false)
  if (seen !== inGrid) {
    setSeen(inGrid)
    setArrived(true)
  }
  if (grid !== undefined)
    return (
      <section className="relative h-full min-w-0 flex-1 bg-canvas" data-editor-sidebar data-grid-view>
        <DeckStrip
          strip={strip}
          onSlideSelection={onSlideSelection}
          grid={{ ...grid, title, save, onRename, onTrash }}
          arrived={arrived}
        />
      </section>
    )
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white" data-editor-sidebar>
      <SidebarHead
        title={title}
        homeHref="/"
        save={save}
        {...(onGrid === undefined ? {} : { onGrid })}
        {...(onRename === undefined ? {} : { onRename })}
        {...(onTrash === undefined ? {} : { onTrash })}
      />
      <DeckStrip strip={strip} onSlideSelection={onSlideSelection} grid={undefined} arrived={arrived} />
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

function onListKey(event: KeyboardEvent<HTMLDivElement>, strip: SlideStrip, drop: () => void, grid: boolean) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  const sideways = grid && ["ArrowLeft", "ArrowRight"].includes(event.key)
  if (!sideways && !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
  const all = stopsOf(event.currentTarget)
  const at = all.findIndex((each) => each === document.activeElement)
  if (at === -1) return
  event.preventDefault()
  event.stopPropagation()
  drop()
  const to = grid
    ? gridStep(
        event.key,
        all.map((each) => {
          const box = each.getBoundingClientRect()
          return { left: Math.round(box.left), top: Math.round(box.top) }
        }),
        at,
      )
    : rovedTo(event.key, all.length, at)
  const target = all[to]
  target?.focus()
  const entry = target?.getAttribute("data-slide-entry")
  if (entry !== null && entry !== undefined) strip.onSelect(Number(entry) - 1)
}

function DeckStrip({
  strip,
  onSlideSelection,
  grid,
  arrived,
}: {
  strip: SlideStrip
  onSlideSelection: ((count: number) => void) | undefined
  grid: GridChrome | undefined
  arrived: boolean
}) {
  const list = useRef<HTMLDivElement>(null)
  const [room, onRoom] = useRoom()
  const slide = strip.slideSize ?? { width: 1920, height: 1080 }
  const lines = grid === undefined ? [] : gridLines(strip.count, gridGroups(strip.count, strip.groupStarts ?? []))
  const fit = gridFitScale(lines, slide, { width: room.width, height: room.height - 2 * gridBarRoom })
  const scale = grid === undefined ? 1 : grid.zoom === "fit" ? fit : grid.zoom
  const onScale = grid?.onScale
  useLayoutEffect(() => {
    onScale?.(scale, fit)
  }, [onScale, scale, fit])
  useLayoutEffect(() => {
    if (!arrived || (document.activeElement !== null && document.activeElement !== document.body)) return
    list.current?.querySelector<HTMLElement>('[data-slide-entry][aria-current="true"]')?.focus()
  }, [arrived])
  const cardWidth = grid === undefined ? thumbWidth : Math.max(1, Math.round(slide.width * scale))
  const cardHeight =
    grid === undefined ? strip.thumbHeight : Math.max(1, Math.round((cardWidth * slide.height) / slide.width))
  const onOpen = grid?.onSlides
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
      grid={grid !== undefined}
      index={slideNumber(index)}
      count={strip.count}
      active={index === strip.current}
      picked={inSet(index)}
      menuSet={inSet(index) ? menuSet : undefined}
      skipped={strip.skipped?.[index] === true}
      markWidth={cardWidth}
      onSkip={
        strip.onSkip === undefined ? undefined : (skipped) => strip.onSkip?.(inSet(index) ? held : [index], skipped)
      }
      reachable={reachable === `slide:${String(index)}`}
      onSelect={(how) => press(index, how)}
      onOpen={
        onOpen === undefined
          ? undefined
          : () => {
              strip.onSelect(index)
              onOpen()
            }
      }
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
        announce(slideListCopy.moved(slideNumber(from), slideNumber(index)))
        strip.onMove?.(from, index)
      }}
    >
      <Filmstrip
        className={
          grid === undefined
            ? thumbCard
            : cn(gridCard, index === strip.current || inSet(index) ? gridCardPicked : gridCardEdge)
        }
        height={cardHeight}
        paint={() => strip.thumb(index, cardWidth)}
        width={cardWidth}
      />
    </SlideItem>
  )
  const present = (key: string) => {
    const at = Number(key.split(":")[1])
    return at >= 0 && at < strip.count
  }
  const reachable = stop !== null && present(stop) ? stop : `slide:${String(strip.current)}`
  const listProps = {
    ref: list,
    role: "group",
    "aria-label": slideListCopy.listName,
    "data-slide-list": true,
    onFocus: (event: FocusEvent<HTMLDivElement>) => {
      const key = event.target.getAttribute("data-stop")
      if (key !== null) setStop(key)
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => onListKey(event, strip, drop, grid !== undefined),
    onKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => {
      if (slideKey(event) !== null || movesWithHistory(event)) following.current = true
    },
    onDropCapture: () => {
      following.current = true
    },
    onBlur: (event: FocusEvent<HTMLDivElement>) => {
      if (event.relatedTarget !== null && !event.currentTarget.contains(event.relatedTarget)) following.current = false
    },
  }
  if (grid !== undefined) {
    const column = gridGaps(slide).column * scale
    return (
      <>
        <Announcer message={message} />
        <div ref={onRoom} className="absolute inset-0 overflow-auto" data-grid-room>
          <div className="flex min-h-full w-max min-w-full px-12 py-[88px]">
            <div {...listProps} className="m-auto flex flex-col" data-slide-grid>
              {lines.map((line, at) => (
                <div
                  key={line.cards[0]}
                  className="flex"
                  data-slide-grid-line={line.group}
                  style={{ gap: column, marginBottom: gridGapAfter(lines, at, slide) * scale }}
                >
                  {line.cards.map(item)}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3 *:pointer-events-auto">
          <GridHead
            title={grid.title}
            save={grid.save}
            canAdd={canAdd}
            onAdd={() => {
              following.current = true
              strip.onAdd?.()
            }}
            onSlides={grid.onSlides}
            {...(grid.onRename === undefined ? {} : { onRename: grid.onRename })}
            {...(grid.onTrash === undefined ? {} : { onTrash: grid.onTrash })}
          />
          {grid.right === undefined ? null : <Island>{grid.right}</Island>}
        </div>
        {grid.bar === undefined ? null : (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center *:pointer-events-auto">
            {grid.bar}
          </div>
        )}
      </>
    )
  }
  return (
    <>
      <div className="flex px-3 pb-2">
        <div className={cn("flex h-7 flex-1 items-center rounded-lg bg-white", surfaceShadow)}>
          <NewSlideMenu
            layouts={canAdd ? (strip.layouts ?? []) : []}
            source={strip.layoutPictures}
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
      <div {...listProps} className="flex flex-1 flex-col gap-1 overflow-y-auto px-1.5 py-1">
        {Array.from({ length: strip.count }, (_, index) => item(index))}
      </div>
    </>
  )
}

function runSlideChange(strip: SlideStrip, index: number, change: SlideKey, announce: (text: string) => void): void {
  if (!slideChangeAllowed(change, index, strip.count)) return
  const number = slideNumber(index)
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
