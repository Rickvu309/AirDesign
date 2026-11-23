import type { ReactNode, Ref } from "react"
import { Button } from "@/components/ui/button"
import { AirdesignMark } from "@/components/ui/airdesign-mark"
import { DeckTitleEdit } from "@/editor/deck-title-edit"
import { SaveStatusLine } from "@/editor/save-status"
import type { SaveStatus } from "@/editor/save-status"
import { EditorIcon } from "@/components/ui/editor-icons"
import { productCopy } from "@/copy/product-copy"
import { cn } from "@/lib/class-names"

export function DeckTitle({
  title,
  className,
  onRename,
  onTrash,
}: {
  title: string
  className?: string
  onTrash?: () => void
  onRename?: (name: string) => void
}) {
  if (onRename !== undefined)
    return (
      <DeckTitleEdit
        title={title}
        onRename={onRename}
        {...(onTrash === undefined ? {} : { onTrash })}
        {...(className === undefined ? {} : { className })}
      />
    )
  return (
    <span className={cn("flex min-w-0 items-center gap-1", className)}>
      <span className="truncate text-[length:var(--type-dense)] font-medium text-foreground">{title}</span>
      <EditorIcon name="chev" size={14} className="text-faint" />
    </span>
  )
}

export function ExportButton({
  onClick,
  ref,
  disabled = false,
}: {
  onClick?: () => void
  ref?: Ref<HTMLButtonElement>
  disabled?: boolean
}) {
  return (
    <Button
      {...(ref === undefined ? {} : { ref })}
      type="button"
      variant="default"
      disabled={disabled}
      className={cn("h-8 rounded-lg px-3 text-[length:var(--type-dense)] font-medium active:translate-y-0")}
      {...(onClick === undefined ? {} : { onClick })}
    >
      {productCopy.exportDeck}
    </Button>
  )
}

export function PanelHead({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-line pr-2 pl-3">{children}</div>
  )
}

export function SidebarHead({
  title,
  trailing,
  gridOff = false,
  onGrid,
  onRename,
  onTrash,
  homeHref,
  save = null,
}: {
  title: string
  trailing?: ReactNode
  gridOff?: boolean
  onGrid?: () => void
  onTrash?: () => void
  onRename?: (name: string) => void
  homeHref?: string
  save?: SaveStatus | null
}) {
  return (
    <div className="group/head grid h-14 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] content-center items-center gap-x-2 pr-2 pl-3">
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
      <span className="flex min-w-0 group-has-[[data-deck-name-field]]/head:col-span-2 group-has-[[data-deck-name-field]]/head:mr-1.5">
        <DeckTitle
          title={title}
          {...(onRename === undefined ? {} : { onRename })}
          {...(onTrash === undefined ? {} : { onTrash })}
        />
      </span>
      {trailing ?? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-md text-quiet active:translate-y-0 group-has-[[data-deck-name-field]]/head:hidden"
          aria-label="Grid"
          data-keeps-selection
          disabled={gridOff}
          {...(onGrid === undefined ? {} : { onClick: onGrid, "aria-pressed": false })}
        >
          <EditorIcon name="grid" size={16} />
        </Button>
      )}
      {save === null ? null : <SaveStatusLine status={save} />}
    </div>
  )
}
