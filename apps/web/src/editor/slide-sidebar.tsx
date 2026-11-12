import { Filmstrip } from "@airdesign/render"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { EditorIcon } from "@/editor/editor-icons"
import { hairlineShadow, SidebarHead, surfaceShadow } from "@/editor/editor-chrome"
import { SlideThumb } from "@/editor/slide-thumb"
import { cn } from "@/lib/class-names"

export type SidebarRun = "working" | "done" | "own" | "compose" | "failed" | "offline"

export const slideThumbWidth = 180

const thumbWidth = slideThumbWidth

const thumbCard = cn("block shrink-0 overflow-hidden rounded-[2px] bg-white", hairlineShadow)

export type SlideStrip = {
  readonly count: number
  readonly current: number
  readonly onSelect: (index: number) => void
  readonly thumbHeight: number
  readonly thumb: (index: number, width: number) => ReactNode
}

export function SlideSidebar({ run, title, strip }: { run: SidebarRun; title: string; strip?: SlideStrip }) {
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white" data-editor-sidebar>
      {strip === undefined ? (
        <>
          <SidebarHead title={title} />
          <SampleStrip run={run} />
        </>
      ) : (
        <>
          <SidebarHead title={title} gridOff />
          <DeckStrip strip={strip} />
        </>
      )}
    </aside>
  )
}

function DeckStrip({ strip }: { strip: SlideStrip }) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto px-2 pb-2" data-slide-list>
      {Array.from({ length: strip.count }, (_, index) => (
        <SlideItem
          key={index}
          index={index + 1}
          active={index === strip.current}
          onSelect={() => strip.onSelect(index)}
        >
          <Filmstrip
            className={thumbCard}
            height={strip.thumbHeight}
            paint={() => strip.thumb(index, thumbWidth)}
            width={thumbWidth}
          />
        </SlideItem>
      ))}
    </div>
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
        <div className="flex pt-1 pl-[var(--space-32)]">
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

function SlideItem({
  index,
  active,
  working = false,
  onSelect,
  children,
}: {
  index: number
  active: boolean
  working?: boolean
  onSelect?: () => void
  children: ReactNode
}) {
  const look = cn("flex items-start gap-2 rounded-[var(--shape-card)] p-2", active && "bg-[var(--row)]")
  const number = (
    <span className="flex w-4 flex-col items-center gap-1.5 pt-0.5">
      <span className={cn("text-xs", active ? "font-medium text-[var(--primary-strong)]" : "text-faint")}>{index}</span>
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
      aria-current={active ? "true" : undefined}
      className={cn(look, "text-left")}
      data-slide-entry={index}
      data-slide-item
      onClick={onSelect}
    >
      {number}
      {children}
    </button>
  )
}

function SectionHead({ name, open = false, range }: { name: string; open?: boolean; range?: string }) {
  return (
    <div className="flex h-8 items-center gap-2 px-2">
      <EditorIcon name={open ? "chev" : "chevr"} size={14} className="text-faint" />
      <span className="text-[length:var(--type-dense)] font-semibold text-foreground">{name}</span>
      {range ? (
        <span className="flex h-5 items-center rounded-sm px-1.5 text-[length:var(--type-caption)] text-faint shadow-[0px_0px_0px_1px_var(--field-edge)]">
          {range}
        </span>
      ) : null}
    </div>
  )
}
