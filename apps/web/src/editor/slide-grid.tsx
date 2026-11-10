import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AirdesignMark } from "@/decks/airdesign-mark"
import { EditorFrame } from "@/editor/editor-frame"
import { DeckTitle, ExportButton, Island, surfaceShadow, ZoomReadout } from "@/editor/editor-chrome"
import { EditorIcon } from "@/editor/editor-icons"
import { EditorToolbar } from "@/editor/editor-toolbar"
import { PastedThumb, SlideThumb } from "@/editor/slide-thumb"
import { cn } from "@/lib/utils"

export type GridState = "idle" | "hover" | "hold" | "pasted"

const sections: { name: string; items: number[] }[] = [
  { name: "Opening", items: [1, 2] },
  { name: "Performance", items: [3, 4, 5] },
  { name: "Outlook", items: [6, 7, 8] },
]

export function SlideGrid({ state, toast }: { state: GridState; toast?: ReactNode }) {
  return (
    <EditorFrame
      top={
        <header className="flex h-24 items-start justify-between px-3 pt-3">
          <Island>
            <span className="flex size-8 items-center justify-center">
              <AirdesignMark size={20} />
            </span>
            <DeckTitle className="pr-2 pl-0.5" />
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-7 gap-1 rounded-md bg-white pr-2 pl-1.5 text-xs font-medium text-foreground hover:bg-white active:translate-y-0",
                surfaceShadow,
              )}
            >
              <EditorIcon name="plus" size={13} />
              New slide
            </Button>
            <span className="mx-1 block h-5 w-px bg-[var(--field-edge)]" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-md text-faint hover:bg-transparent active:translate-y-0"
              aria-label="Slides"
            >
              <EditorIcon name="slide" size={16} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-md bg-line text-foreground hover:bg-line active:translate-y-0"
              aria-label="Grid"
              aria-pressed
            >
              <EditorIcon name="grid" size={16} />
            </Button>
          </Island>
          <Island>
            <ZoomReadout value="36%" tone="ink" />
            <ExportButton />
          </Island>
        </header>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex w-[1296px] flex-col gap-9 px-[87px]">
          {sections.map((section, index) => (
            <Section
              key={section.name}
              name={section.name}
              items={itemsFor(section.items, index, state)}
              state={state}
            />
          ))}
        </div>
        <div className="mt-auto flex justify-center pb-6">
          <EditorToolbar />
        </div>
      </div>
      {toast}
    </EditorFrame>
  )
}

function itemsFor(items: number[], index: number, state: GridState) {
  if (index === 0 && state === "pasted") return [1, 2, "region", "churn"]
  if (index === 1 && state === "hold") return [3, 4, 5, "ghost"]
  return items
}

function Section({ name, items, state }: { name: string; items: (number | string)[]; state: GridState }) {
  const showHandle = name === "Performance" && (state === "hover" || state === "hold")
  let number = startNumber(name, state)
  return (
    <section className="flex flex-col gap-4">
      <div className="flex h-5 items-center gap-3">
        <h2 className="text-xs font-semibold text-foreground">{name}</h2>
        <span className="block h-px flex-1 bg-line" />
      </div>
      <div className="relative flex gap-8">
        {showHandle ? (
          <span className="absolute top-1/2 left-[-26px] h-9 w-1.5 -translate-y-1/2 rounded-full bg-[var(--drop)]" />
        ) : null}
        {state === "hover" && name === "Performance" ? <InsertMark className="left-[308px] size-4" /> : null}
        {state === "hold" && name === "Performance" ? <InsertMark className="left-[966px] size-7" large /> : null}
        {items.map((item) => {
          const ghost = item === "ghost"
          const label = ghost ? "" : String(number++)
          return <GridCard key={String(item)} item={item} label={label} state={state} />
        })}
      </div>
    </section>
  )
}

function startNumber(name: string, state: GridState) {
  if (name === "Opening") return 1
  if (name === "Performance") return state === "pasted" ? 5 : 3
  return state === "pasted" ? 8 : state === "hold" ? 6 : 6
}

function GridCard({ item, label, state }: { item: number | string; label: string; state: GridState }) {
  const pasted = item === "region" || item === "churn"
  const selected = state === "pasted" ? pasted : state === "idle" || state === "hover" ? item === 3 : false
  const dark = item === 1 || item === 8
  const body =
    item === "ghost" ? (
      <div className="h-[169px] w-[300px] rounded-[2px] border-2 border-dashed border-[var(--placeholder)] bg-line" />
    ) : item === "region" || item === "churn" ? (
      <PastedThumb kind={item} />
    ) : (
      <SlideThumb index={item as number} width={300} />
    )
  return (
    <div className={cn("relative rounded-sm", selected && "shadow-[0_0_0_2px_var(--ring)]")}>
      {body}
      {label ? (
        <span
          className={cn(
            "absolute top-[6px] left-[var(--space-8)] text-[length:var(--type-caption)]",
            selected ? "font-semibold text-[var(--primary-strong)]" : dark ? "text-white/70" : "text-faint",
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  )
}

function InsertMark({ className, large = false }: { className: string; large?: boolean }) {
  return (
    <span
      className={cn(
        "absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-primary-strong text-white",
        className,
      )}
    >
      <EditorIcon name="plus" size={large ? 14 : 10} strokeWidth={3.2} />
    </span>
  )
}
