import { Filmstrip } from "@airdesign/render"
import { useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { EditorIcon } from "@/editor/editor-icons"
import { hairlineShadow, SidebarHead, surfaceShadow } from "@/editor/editor-chrome"
import { slideKey } from "@/editor/slide-keys"
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
  readonly onAdd?: (layoutPart?: string) => void
  readonly layouts?: readonly LayoutChoice[]
  readonly onClone?: (index: number) => void
  readonly onRemove?: (index: number) => void
  readonly onMove?: (from: number, to: number) => void
  readonly thumbHeight: number
  readonly thumb: (index: number, width: number) => ReactNode
}

export function SlideSidebar({
  run,
  title,
  strip,
  onRename,
}: {
  run: SidebarRun
  title: string
  strip?: SlideStrip
  onRename?: (name: string) => void
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
          <SidebarHead title={title} gridOff {...(onRename === undefined ? {} : { onRename })} />
          <DeckStrip strip={strip} />
        </>
      )}
    </aside>
  )
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
      active={index === strip.current}
      onSelect={() => strip.onSelect(index)}
      onKeyDown={(event) => onSlideKey(strip, index, event)}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", String(index))
        event.dataTransfer.effectAllowed = "move"
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const from = Number(event.dataTransfer.getData("text/plain"))
        if (Number.isInteger(from)) strip.onMove?.(from, index)
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
            onChoose={(part) => strip.onAdd?.(part)}
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
      <div
        ref={list}
        className="flex flex-col gap-1 overflow-y-auto px-2 pb-2"
        data-slide-list
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
  open,
  range,
  onToggle,
  stack,
  children,
}: {
  name: string
  open: boolean
  range: string | undefined
  onToggle: () => void
  stack: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <SectionHead name={name} open={open} {...(range === undefined ? {} : { range })} onToggle={onToggle} />
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

function onSlideKey(strip: SlideStrip, index: number, event: KeyboardEvent<HTMLButtonElement>) {
  const change = slideKey(event)
  if (change === null) return
  event.preventDefault()
  if (change === "remove") strip.onRemove?.(index)
  if (change === "clone") strip.onClone?.(index)
  if (change === "up") strip.onMove?.(index, index - 1)
  if (change === "down") strip.onMove?.(index, index + 1)
}

function SlideItem({
  index,
  active,
  working = false,
  onSelect,
  onKeyDown,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}: {
  index: number
  active: boolean
  working?: boolean
  onSelect?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void
  children: ReactNode
}) {
  const look = cn("flex items-start gap-2 rounded-[var(--shape-card)] p-2", active && "bg-[var(--row)]")
  const number = (
    <span className="flex w-4 flex-col items-center gap-1.5 pt-0.5">
      <span className={cn("text-xs", active ? "font-medium text-[color:color-mix(in_oklch,var(--primary-strong),black_15%)]" : "text-quiet")}>{index}</span>
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
  return (
    <button
      type="button"
      draggable={onDragStart !== undefined}
      aria-current={active ? "true" : undefined}
      className={cn(look, "text-left")}
      data-slide-entry={index}
      data-slide-item
      onClick={onSelect}
      onKeyDown={onKeyDown}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {number}
      {children}
    </button>
  )
}

function SectionHead({
  name,
  open = false,
  range,
  onToggle,
}: {
  name: string
  open?: boolean
  range?: string
  onToggle?: () => void
}) {
  const look = "flex h-8 items-center gap-2 px-2"
  const body = (
    <>
      <EditorIcon name={open ? "chev" : "chevr"} size={14} className="text-faint" />
      <span className="min-w-0 truncate text-[length:var(--type-dense)] font-semibold text-foreground">{name}</span>
      {range ? (
        <span className="flex h-5 shrink-0 items-center rounded-sm px-1.5 text-[length:var(--type-caption)] text-muted-foreground shadow-[0px_0px_0px_1px_var(--field-edge)]">
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
      className={cn(look, "w-full text-left")}
      data-section-head
      onClick={onToggle}
    >
      {body}
    </button>
  )
}
