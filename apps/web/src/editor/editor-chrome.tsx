import type { ReactNode, Ref } from "react"
import { Button } from "@/components/ui/button"
import { AirdesignMark } from "@/decks/airdesign-mark"
import { DeckTitleEdit } from "@/editor/deck-title-edit"
import { SaveStatusLine } from "@/editor/save-status"
import type { SaveStatus } from "@/editor/use-deck-status"
import { EditorIcon } from "@/editor/editor-icons"
import { productCopy } from "@/copy/product-copy"
import { cn } from "@/lib/class-names"

export const surfaceShadow = "shadow-[0px_0px_0px_1px_var(--field-edge),0px_1px_2px_var(--black-4)]"

export const cardShadow = "shadow-[0px_0px_0px_1px_var(--black-7),0px_2px_8px_var(--black-4)]"

export const floatShadow = "shadow-[0px_0px_0px_1px_var(--black-8),0px_12px_32px_var(--black-12)]"

export const hairlineShadow = "shadow-[0px_0px_0px_1px_var(--field-edge)]"

export function DeckTitle({
  title,
  className,
  onRename,
}: {
  title: string
  className?: string
  onRename?: (name: string) => void
}) {
  if (onRename !== undefined)
    return <DeckTitleEdit title={title} onRename={onRename} {...(className === undefined ? {} : { className })} />
  return (
    <span className={cn("flex min-w-0 items-center gap-1", className)}>
      <span className="truncate text-[length:var(--type-dense)] font-medium text-foreground">{title}</span>
      <EditorIcon name="chev" size={14} className="text-faint" />
    </span>
  )
}

export function ExportButton({
  faded = false,
  onClick,
  ref,
}: {
  faded?: boolean
  onClick?: () => void
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <Button
      {...(ref === undefined ? {} : { ref })}
      type="button"
      variant="default"
      className={cn(
        "h-8 rounded-lg px-3 text-[length:var(--type-dense)] font-medium active:translate-y-0",
        faded && "opacity-40",
      )}
      {...(onClick === undefined ? {} : { onClick })}
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

export function PanelHead({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-line pr-2 pl-3">{children}</div>
  )
}

export function Island({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-11 items-center gap-1 rounded-xl bg-white px-1.5", cardShadow, className)}>
      {children}
    </div>
  )
}

export function SidebarHead({
  title,
  trailing,
  gridOff = false,
  onGrid,
  onRename,
  homeHref,
  save = null,
}: {
  title: string
  trailing?: ReactNode
  gridOff?: boolean
  onGrid?: () => void
  onRename?: (name: string) => void
  homeHref?: string
  save?: SaveStatus | null
}) {
  return (
    <div className="grid h-14 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] content-center items-center gap-x-2 pr-2 pl-3">
      {homeHref === undefined ? (
        <AirdesignMark size={20} />
      ) : (
        <a
          href={homeHref}
          aria-label={productCopy.goToDecks}
          className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-black/4"
        >
          <AirdesignMark size={20} />
        </a>
      )}
      <span className="flex min-w-0">
        <DeckTitle title={title} {...(onRename === undefined ? {} : { onRename })} />
      </span>
      {trailing ?? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-md text-quiet active:translate-y-0"
          aria-label="Grid"
          disabled={gridOff}
          {...(onGrid === undefined ? {} : { onClick: onGrid, "aria-pressed": false })}
        >
          <EditorIcon name="grid" size={16} />
        </Button>
      )}
      {save === null ? null : <SaveStatusLine status={save} className="col-span-2 col-start-2 px-1.5" />}
    </div>
  )
}
