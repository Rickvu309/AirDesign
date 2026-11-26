import type { ReactNode } from "react"
import { AirdesignMark } from "@/components/ui/airdesign-mark"
import { DeckTitleEdit } from "@/editor/deck-title-edit"
import { SaveStatusLine } from "@/editor/save-status"
import type { SaveStatus } from "@/editor/save-status"
import { EditorIcon } from "@/components/ui/editor-icons"
import { productCopy } from "@/copy/product-copy"
import { cn } from "@/lib/class-names"
import { surfaceShadow } from "@/components/ui/shadows"
import { Button } from "@/components/ui/button"
import { slideListCopy } from "@/copy/slide-list-copy"

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
      <span className="min-w-0 truncate text-[length:var(--type-dense)] font-medium text-foreground">{title}</span>
      <EditorIcon name="chev" size={14} className="text-faint" />
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
    <div className={cn("flex h-11 items-center gap-1 rounded-xl bg-white px-1.5", surfaceShadow, className)}>
      {children}
    </div>
  )
}

export type GridHeadProps = {
  title: string
  save: SaveStatus | null
  canAdd: boolean
  onAdd: () => void
  onSlides: () => void
  onTrash?: () => void
  onRename?: (name: string) => void
  selected?: number | null
}

export function GridHead({ title, save, canAdd, onAdd, onSlides, onRename, onTrash, selected = null }: GridHeadProps) {
  return (
    <Island>
      <a
        href="/"
        aria-label={productCopy.goToDecks}
        className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-black/4"
      >
        <AirdesignMark size={20} />
      </a>
      <DeckTitle
        title={title}
        className="max-w-[240px] pr-2 pl-0.5"
        {...(onRename === undefined ? {} : { onRename })}
        {...(onTrash === undefined ? {} : { onTrash })}
      />
      {save === null ? null : <SaveStatusLine status={save} />}
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-7 gap-1 rounded-md bg-white pr-2 pl-1.5 text-xs font-medium text-foreground hover:bg-white active:translate-y-0",
          surfaceShadow,
        )}
        disabled={!canAdd}
        onClick={onAdd}
      >
        <EditorIcon name="plus" size={13} />
        {slideListCopy.newSlide}
      </Button>
      <span aria-hidden="true" className="mx-1 block h-5 w-px bg-[var(--field-edge)]" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-md text-quiet active:translate-y-0"
        aria-label={slideListCopy.slidesView}
        aria-pressed={false}
        onClick={onSlides}
      >
        <EditorIcon name="slide" size={16} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-md bg-line text-foreground hover:bg-line active:translate-y-0"
        aria-label={slideListCopy.gridView}
        aria-pressed
        onClick={onSlides}
      >
        <EditorIcon name="grid" size={16} />
      </Button>
      {selected === null ? null : (
        <span className="px-2 text-xs font-medium text-foreground tabular-nums" data-grid-selected>
          {slideListCopy.selected(selected)}
        </span>
      )}
    </Island>
  )
}

export function SidebarHead({
  title,
  onRename,
  onTrash,
  homeHref,
  save = null,
  onGrid,
}: {
  title: string
  onTrash?: () => void
  onRename?: (name: string) => void
  homeHref?: string
  save?: SaveStatus | null
  onGrid?: () => void
}) {
  return (
    <div className="flex shrink-0 flex-col pt-2 pr-2 pb-1 pl-3">
      <div className="flex h-8 items-center gap-1">
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
        <DeckTitle
          title={title}
          className="min-w-0 flex-1"
          {...(onRename === undefined ? {} : { onRename })}
          {...(onTrash === undefined ? {} : { onTrash })}
        />
        {onGrid === undefined ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-md text-quiet active:translate-y-0"
            aria-label={slideListCopy.gridView}
            aria-pressed={false}
            data-view-toggle
            onClick={onGrid}
          >
            <EditorIcon name="grid" size={16} />
          </Button>
        )}
      </div>
      {save === null ? null : <SaveStatusLine status={save} />}
    </div>
  )
}
