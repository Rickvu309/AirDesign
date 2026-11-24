import type { ReactNode } from "react"
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

export function SidebarHead({
  title,
  onRename,
  onTrash,
  homeHref,
  save = null,
}: {
  title: string
  onTrash?: () => void
  onRename?: (name: string) => void
  homeHref?: string
  save?: SaveStatus | null
}) {
  return (
    <div className="flex shrink-0 flex-col pt-2 pr-2 pb-1 pl-3">
      <div className="flex h-8 items-center justify-between">
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
      </div>
      <div className="flex w-full min-w-0">
        <DeckTitle
          title={title}
          className="min-w-0 flex-1"
          {...(onRename === undefined ? {} : { onRename })}
          {...(onTrash === undefined ? {} : { onTrash })}
        />
      </div>
      {save === null ? null : <SaveStatusLine status={save} />}
    </div>
  )
}
