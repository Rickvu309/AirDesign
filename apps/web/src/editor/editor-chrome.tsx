import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AirdesignMark } from "@/decks/airdesign-mark"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/utils"

export const deckTitle = "Q3 Investor Update"

export const surfaceShadow = "shadow-[0px_0px_0px_1px_var(--field-edge),0px_1px_2px_var(--black-4)]"

export const brandShadow =
  "shadow-[inset_0px_1px_0px_var(--white-35),0px_0px_0px_1px_var(--primary-strong),0px_1px_2px_var(--black-12)]"

export const cardShadow = "shadow-[0px_0px_0px_1px_var(--black-7),0px_2px_8px_var(--black-4)]"

export const floatShadow = "shadow-[0px_0px_0px_1px_var(--black-8),0px_12px_32px_var(--black-12)]"

export const hairlineShadow = "shadow-[0px_0px_0px_1px_var(--field-edge)]"

export function DeckTitle({ className }: { className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1", className)}>
      <span className="truncate text-[length:var(--type-dense)] font-medium text-foreground">{deckTitle}</span>
      <EditorIcon name="chev" size={14} className="text-faint" />
    </span>
  )
}

export function ExportButton({ faded = false }: { faded?: boolean }) {
  return (
    <Button
      type="button"
      variant="default"
      className={cn(
        "h-8 rounded-lg px-3 text-[length:var(--type-dense)] font-medium active:translate-y-0",
        faded && "opacity-40",
      )}
    >
      Export
    </Button>
  )
}

export function ZoomReadout({ value, tone = "quiet" }: { value: string; tone?: "quiet" | "ink" }) {
  return (
    <span className={cn("flex h-8 items-center gap-0.5", tone === "ink" ? "gap-1 px-2" : "pr-1")}>
      <span className={cn("text-[length:var(--type-dense)]", tone === "ink" ? "text-foreground" : "text-quiet")}>
        {value}
      </span>
      <EditorIcon name="chev" size={tone === "ink" ? 13 : 12} className="text-faint" />
    </span>
  )
}

export function Island({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-11 items-center gap-1 rounded-xl bg-white px-1.5", cardShadow, className)}>
      {children}
    </div>
  )
}

export function SidebarHead({ trailing }: { trailing?: ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between pr-2 pl-3">
      <span className="flex items-center gap-2">
        <AirdesignMark size={20} />
        <DeckTitle />
      </span>
      {trailing ?? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-md text-quiet active:translate-y-0"
          aria-label="Grid"
        >
          <EditorIcon name="grid" size={16} />
        </Button>
      )}
    </div>
  )
}
