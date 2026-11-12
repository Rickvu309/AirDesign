import { Filmstrip } from "@airdesign/render"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { EditorIcon } from "@/editor/editor-icons"
import { SidebarHead, surfaceShadow } from "@/editor/editor-chrome"
import { SlideThumb } from "@/editor/slide-thumb"
import { cn } from "@/lib/class-names"

export type SidebarRun = "working" | "done" | "own" | "compose" | "failed" | "offline"

export const slideThumbWidth = 180

const thumbWidth = slideThumbWidth

const thumbFrame =
  "block shrink-0 overflow-hidden rounded-[2px] bg-canvas shadow-[inset_0px_0px_0px_1px_var(--field-edge)]"

export type SlideStrip = {
  readonly count: number
  readonly current: number
  readonly onSelect: (index: number) => void
  readonly thumbHeight: number
  readonly thumb: (index: number, width: number) => ReactNode
}

export function SlideSidebar({ run, title, strip }: { run: SidebarRun; title: string; strip?: SlideStrip }) {
  const queuedFrom = run === "working" ? 4 : 0
  if (strip !== undefined) {
    return (
      <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white">
        <SidebarHead title={title} />
        <div className="flex flex-col gap-1 overflow-y-auto px-2 pb-2" data-slide-list>
          {Array.from({ length: strip.count }, (_, index) => (
            <OpenedItem
              key={index}
              index={index + 1}
              active={index === strip.current}
              onSelect={() => strip.onSelect(index)}
              thumb={strip.thumb}
              thumbHeight={strip.thumbHeight}
            />
          ))}
        </div>
      </aside>
    )
  }
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-white">
      <SidebarHead title={title} />
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
        <StripItem index={1} run={run} queuedFrom={queuedFrom} />
        <StripItem index={2} run={run} queuedFrom={queuedFrom} />
        <SectionHead name="Performance" open />
        <StripItem index={3} run={run} queuedFrom={queuedFrom} />
        <StripItem index={4} run={run} queuedFrom={queuedFrom} />
        <StripItem index={5} run={run} queuedFrom={queuedFrom} />
        <SectionHead name="Outlook" range="6 to 8" />
        <div className="flex pt-1 pl-[var(--space-32)]">
          <div className="flex w-[180px] flex-col items-center">
            <SlideThumb index={6} width={thumbWidth} queued={queuedFrom > 0 && 6 >= queuedFrom} />
            <span className="block h-1.5 w-[166px] rounded-b-sm bg-white shadow-[0px_0px_0px_1px_var(--field-edge)]" />
            <span className="block h-1.5 w-[150px] rounded-b-sm bg-white shadow-[0px_0px_0px_1px_var(--field-edge)]" />
          </div>
        </div>
      </div>
    </aside>
  )
}

function OpenedItem({
  index,
  active,
  onSelect,
  thumb,
  thumbHeight,
}: {
  index: number
  active: boolean
  onSelect: () => void
  thumb: SlideStrip["thumb"]
  thumbHeight: number
}) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      data-slide-entry={index}
      onClick={onSelect}
      className={cn("flex items-start gap-2 rounded-[var(--shape-card)] p-2 text-left", active && "bg-[var(--row)]")}
    >
      <span className="flex w-4 flex-col items-center gap-1.5 pt-0.5">
        <span className={cn("text-xs", active ? "font-medium text-[var(--primary-strong)]" : "text-faint")}>
          {index}
        </span>
      </span>
      <Filmstrip
        className={thumbFrame}
        height={thumbHeight}
        paint={() => thumb(index - 1, thumbWidth)}
        width={thumbWidth}
      />
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

function StripItem({ index, run, queuedFrom }: { index: number; run: SidebarRun; queuedFrom: number }) {
  const active = index === 3
  const working = (run === "working" || run === "own") && index === 3
  return (
    <div className={cn("flex items-start gap-2 rounded-[var(--shape-card)] p-2", active && "bg-[var(--row)]")}>
      <span className="flex w-4 flex-col items-center gap-1.5 pt-0.5">
        <span className={cn("text-xs", active ? "font-medium text-[var(--primary-strong)]" : "text-faint")}>
          {index}
        </span>
        {working ? <span className="block size-1.5 rounded-full bg-primary" /> : null}
      </span>
      <SlideThumb index={index} width={thumbWidth} queued={queuedFrom > 0 && index >= queuedFrom} />
    </div>
  )
}
