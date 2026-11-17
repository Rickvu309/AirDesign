import { Filmstrip } from "@airdesign/render"
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { Announcer, type Announcement } from "@/components/ui/announcer"
import { Button } from "@/components/ui/button"
import { slideListCopy } from "@/copy/slide-list-copy"
import { EditorIcon } from "@/editor/editor-icons"
import { hairlineShadow, SidebarHead, surfaceShadow } from "@/editor/editor-chrome"
import { slideKey, type SlideKey } from "@/editor/slide-keys"
import type { SaveStatus } from "@/editor/use-deck-status"
import { SlideMenu, slideChangeAllowed } from "@/editor/slide-menu"
import { NewSlideMenu } from "@/editor/new-slide-menu"
import { SlideThumb } from "@/editor/slide-thumb"
import type { LayoutChoice } from "@/slide-layout"
import { cn } from "@/lib/class-names"

export type SidebarRun = "working" | "done" | "own" | "compose" | "failed" | "offline"

export const slideThumbWidth = 180

const thumbWidth = slideThumbWidth

const thumbCard = cn("block shrink-0 overflow-hidden rounded-[2px] bg-white", hairlineShadow)

export type StripSection = { readonly name: string; readonly start: number }

const noSections: readonly StripSection[] = []

export type SlideStrip = {
  readonly count: number
  readonly sections?: readonly StripSection[]
  readonly current: number
  readonly onSelect: (index: number) => void
  readonly onAdd?: (layoutPart?: string, after?: number) => void
  readonly layouts?: readonly LayoutChoice[]
  readonly onClone?: (index: number) => void
  readonly onRemove?: (index: number) => void
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
  run,
  title,
  strip,
  onRename,
  onGrid,
  save = null,
}: {
  run: SidebarRun
  title: string
  strip?: SlideStrip
  onRename?: (name: string) => void
  onGrid?: () => void
  save?: SaveStatus | null
}) {
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white" data-editor-sidebar>
      {strip === undefined ? (
        <>
          <SidebarHead title={title} />
          <SampleStrip run={run} />
        </>
      ) : (
        <>
          <SidebarHead
            title={title}
            homeHref="/"
            save={save}
            {...(onGrid === undefined ? { gridOff: true } : { onGrid })}
            {...(onRename === undefined ? {} : { onRename })}
          />
          <DeckStrip strip={strip} />
        </>
      )}
    </aside>
  )
}

const stops = "[data-slide-item], [data-section-head]"

function stopsOf(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>(stops)]
}

function rovedTo(key: string, count: number, at: number): number {
  if (key === "ArrowDown") return Math.min(at + 1, count - 1)
  if (key === "ArrowUp") return Math.max(at - 1, 0)
  return key === "Home" ? 0 : count - 1
}

function onListKey(event: KeyboardEvent<HTMLDivElement>, strip: SlideStrip) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
  const all = stopsOf(event.currentTarget)
  const at = all.findIndex((each) => each === document.activeElement)
  if (at === -1) return
  event.preventDefault()
  const target = all[rovedTo(event.key, all.length, at)]
  target?.focus()
  const entry = target?.getAttribute("data-slide-entry")
  if (entry !== null && entry !== undefined) strip.onSelect(Number(entry) - 1)
}

function DeckStrip({ strip }: { strip: SlideStrip }) {
  const list = useRef<HTMLDivElement>(null)
  const following = useRef(false)
  const { current, count } = strip
  useLayoutEffect(() => {
    if (!following.current) return
    const next = list.current?.querySelector<HTMLElement>(`[data-slide-entry="${current + 1}"]`)
    if (next === null || next === undefined) return
    following.current = false
    if (next !== document.activeElement) next.focus()
  }, [current, count])
  const sections = strip.sections ?? noSections
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set())
  const [stop, setStop] = useState<string | null>(null)
  const [message, setMessage] = useState<Announcement | null>(null)
  const announce = useCallback(
    (text: string) => setMessage((held) => ({ text, odd: held === null ? false : !held.odd })),
    [],
  )
  useSlideSay(strip.say, announce)
  const [seen, setSeen] = useState(strip.current)
  if (seen !== strip.current) {
    setSeen(strip.current)
    const at = sectionAt(sections, strip.current)
    if (collapsed.has(at)) setCollapsed(new Set([...collapsed].filter((each) => each !== at)))
  }
  const item = (index: number) => (
    <SlideItem
      key={index}
      index={index + 1}
      count={strip.count}
      active={index === strip.current}
      reachable={reachable === `slide:${String(index)}`}
      onSelect={() => strip.onSelect(index)}
      onKeyDown={(event) => onSlideKey(strip, index, event, announce)}
      onChoose={(change) => {
        following.current = true
        runSlideChange(strip, index, change, announce)
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
  const visible = (index: number) => {
    const at = sectionAt(sections, index)
    return at === -1 || !collapsed.has(at)
  }
  const fallback = visible(strip.current)
    ? `slide:${String(strip.current)}`
    : `section:${String(sectionAt(sections, strip.current))}`
  const present = (key: string) => {
    const [kind, number] = key.split(":")
    const at = Number(number)
    if (kind === "section") return at >= 0 && at < sections.length
    return at >= 0 && at < strip.count && visible(at)
  }
  const reachable = stop !== null && present(stop) ? stop : fallback
  const toggle = (number: number) =>
    setCollapsed((held) =>
      held.has(number) ? new Set([...held].filter((each) => each !== number)) : new Set([...held, number]),
    )
  return (
    <>
      <div className="flex px-3 pb-2">
        <div className={cn("flex h-8 flex-1 items-center rounded-lg bg-white", surfaceShadow)}>
          <NewSlideMenu
            layouts={strip.onAdd === undefined ? [] : (strip.layouts ?? [])}
            onChoose={(part) => {
              strip.onAdd?.(part)
            }}
          />
          <span className="block h-8 w-px bg-[var(--field-edge)]" />
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 rounded-none px-0 text-foreground hover:bg-transparent active:translate-y-0"
            aria-label="Add slide"
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
        className="flex flex-col gap-1 overflow-y-auto px-2 py-1"
        data-slide-list
        onFocus={(event: FocusEvent<HTMLDivElement>) => {
          const key = event.target.getAttribute("data-stop")
          if (key !== null) setStop(key)
        }}
        onKeyDown={(event) => onListKey(event, strip)}
        onKeyDownCapture={(event) => {
          if (slideKey(event) !== null) following.current = true
        }}
        onDropCapture={() => {
          following.current = true
        }}
        onBlur={(event) => {
          if (event.relatedTarget !== null && !event.currentTarget.contains(event.relatedTarget))
            following.current = false
        }}
      >
        {sections.length === 0
          ? Array.from({ length: strip.count }, (_, index) => item(index))
          : sections.map((section, number) => {
              const end = sections[number + 1]?.start ?? strip.count
              const open = !collapsed.has(number)
              return (
                <SectionBlock
                  key={`${number}:${section.name}`}
                  name={section.name}
                  reachable={reachable === `section:${String(number)}`}
                  stop={`section:${String(number)}`}
                  open={open}
                  range={open ? undefined : rangeOf(section.start, end)}
                  onToggle={() => toggle(number)}
                  stack={
                    <Filmstrip
                      className={thumbCard}
                      height={strip.thumbHeight}
                      paint={() => strip.thumb(section.start, thumbWidth)}
                      width={thumbWidth}
                    />
                  }
                >
                  {Array.from({ length: end - section.start }, (_, offset) => item(section.start + offset))}
                </SectionBlock>
              )
            })}
      </div>
    </>
  )
}

function sectionAt(sections: readonly StripSection[], index: number): number {
  let found = -1
  for (const [number, section] of sections.entries()) {
    if (section.start <= index) found = number
  }
  return found
}

function rangeOf(start: number, end: number): string {
  return end - start > 1 ? `${start + 1} to ${end}` : String(start + 1)
}

function SectionBlock({
  name,
  stop,
  reachable,
  open,
  range,
  onToggle,
  stack,
  children,
}: {
  name: string
  stop: string
  reachable: boolean
  open: boolean
  range: string | undefined
  onToggle: () => void
  stack: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <SectionHead
        name={name}
        stop={stop}
        reachable={reachable}
        open={open}
        {...(range === undefined ? {} : { range })}
        onToggle={onToggle}
      />
      {open ? (
        children
      ) : (
        <div className="flex pt-1 pl-[var(--space-32)]" data-section-stack>
          <div className="flex w-[180px] flex-col items-center">
            {stack}
            <span className="block h-1.5 w-[166px] rounded-b-sm bg-white shadow-[0px_0px_0px_1px_var(--field-edge)]" />
            <span className="block h-1.5 w-[150px] rounded-b-sm bg-white shadow-[0px_0px_0px_1px_var(--field-edge)]" />
          </div>
        </div>
      )}
    </>
  )
}

function SampleStrip({ run }: { run: SidebarRun }) {
  const queuedFrom = run === "working" ? 4 : 0
  const working = run === "working" || run === "own"
  const item = (index: number) => (
    <SlideItem index={index} active={index === 3} working={working && index === 3}>
      <SlideThumb index={index} width={thumbWidth} queued={queuedFrom > 0 && index >= queuedFrom} />
    </SlideItem>
  )
  return (
    <>
      <div className="flex px-3 pb-2">
        <div className={cn("flex h-8 flex-1 items-center rounded-lg bg-white", surfaceShadow)}>
          <span className="flex flex-1 items-center justify-center gap-1 text-[length:var(--type-dense)] font-medium text-foreground">
            New slide
            <EditorIcon name="chev" size={13} className="text-faint" />
          </span>
          <span className="block h-8 w-px bg-[var(--field-edge)]" />
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 rounded-none px-0 text-foreground hover:bg-transparent active:translate-y-0"
            aria-label="Add slide"
          >
            <EditorIcon name="plus" size={15} />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-1 overflow-hidden px-2 pb-2">
        <SectionHead name="Opening" open />
        {item(1)}
        {item(2)}
        <SectionHead name="Performance" open />
        {item(3)}
        {item(4)}
        {item(5)}
        <SectionHead name="Outlook" range="6 to 8" />
        <div className="flex pt-1 pl-[var(--space-32)]" data-section-stack>
          <div className="flex w-[180px] flex-col items-center">
            <SlideThumb index={6} width={thumbWidth} queued={queuedFrom > 0 && 6 >= queuedFrom} />
            <span className="block h-1.5 w-[166px] rounded-b-sm bg-white shadow-[0px_0px_0px_1px_var(--field-edge)]" />
            <span className="block h-1.5 w-[150px] rounded-b-sm bg-white shadow-[0px_0px_0px_1px_var(--field-edge)]" />
          </div>
        </div>
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
): void {
  const change = slideKey(event)
  if (change === null) return
  event.preventDefault()
  runSlideChange(strip, index, change, announce)
}

function SlideItem({
  index,
  count = 0,
  active,
  reachable = true,
  working = false,
  onSelect,
  onChoose,
  onKeyDown,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}: {
  index: number
  count?: number
  active: boolean
  reachable?: boolean
  working?: boolean
  onSelect?: () => void
  onChoose?: (change: SlideKey) => void
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void
  children: ReactNode
}) {
  const entry = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const latest = useRef({ onSelect, onChoose })
  useLayoutEffect(() => {
    latest.current = { onSelect, onChoose }
  })
  const onMenuChoose = useCallback((change: SlideKey) => latest.current.onChoose?.(change), [])
  const onMenuOpenChange = useCallback((next: boolean) => {
    setMenuOpen(next)
    if (next) latest.current.onSelect?.()
    else if (entry.current?.isConnected) entry.current.focus()
  }, [])
  const look = cn("flex items-start gap-2 rounded-[var(--shape-card)] p-2", active && "bg-[var(--row)]")
  const number = (
    <span className="flex w-4 flex-col items-center gap-1.5 pt-0.5">
      <span className={cn("text-xs", active ? "font-medium text-index" : "text-quiet")}>{index}</span>
      {working ? <span className="block size-1.5 rounded-full bg-primary" /> : null}
    </span>
  )
  if (onSelect === undefined) {
    return (
      <div className={look} data-slide-item>
        {number}
        {children}
      </div>
    )
  }
  const openMenu = () => {
    onSelect?.()
    setMenuOpen(true)
  }
  return (
    <div className="relative">
      <button
        ref={entry}
        type="button"
        draggable={onDragStart !== undefined}
        aria-current={active ? "true" : undefined}
        aria-label={slideListCopy.slideName(index, count)}
        tabIndex={reachable ? 0 : -1}
        className={cn(look, "w-full text-left")}
        data-stop={`slide:${String(index - 1)}`}
        data-slide-entry={index}
        data-slide-item
        onClick={onSelect}
        onContextMenu={
          onChoose === undefined
            ? undefined
            : (event) => {
                event.preventDefault()
                openMenu()
              }
        }
        onKeyDown={(event) => {
          if (onChoose !== undefined && (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))) {
            event.preventDefault()
            openMenu()
            return
          }
          onKeyDown?.(event)
        }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {number}
        {children}
      </button>
      {onChoose === undefined ? null : (
        <SlideMenu
          number={index}
          index={index - 1}
          count={count}
          open={menuOpen}
          onOpenChange={onMenuOpenChange}
          onChoose={onMenuChoose}
        />
      )}
    </div>
  )
}

function SectionHead({
  name,
  stop,
  reachable = true,
  open = false,
  range,
  onToggle,
}: {
  name: string
  stop?: string
  reachable?: boolean
  open?: boolean
  range?: string
  onToggle?: () => void
}) {
  const look = "flex min-h-8 shrink-0 items-start gap-2 px-2 py-1.5"
  const body = (
    <>
      <EditorIcon name={open ? "chev" : "chevr"} size={14} className="mt-0.5 shrink-0 text-faint" />
      <span className="min-w-0 text-[length:var(--type-dense)] leading-[var(--leading-dense)] font-semibold wrap-break-word text-foreground">
        {name}
      </span>
      {range ? (
        <span className="flex h-5 shrink-0 items-center rounded-sm px-1.5 text-[length:var(--type-caption)] whitespace-nowrap text-muted-foreground shadow-[0px_0px_0px_1px_var(--field-edge)]">
          {range}
        </span>
      ) : null}
    </>
  )
  if (onToggle === undefined) {
    return (
      <div className={look} data-section-head>
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={range === undefined ? name : `${name}, ${slideListCopy.sectionRange(range)}`}
      tabIndex={reachable ? 0 : -1}
      className={cn(look, "w-full text-left")}
      {...(stop === undefined ? {} : { "data-stop": stop })}
      data-section-head
      onClick={onToggle}
    >
      {body}
    </button>
  )
}
