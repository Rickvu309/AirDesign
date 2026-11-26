import { useEffect, useRef, useState } from "react"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EditorMenuContent } from "@/editor/editor-menu"
import { deckActionsOf, productCopy } from "@/copy/product-copy"
import { nameReading } from "@/editor/deck-name-edit"
import { EditorIcon } from "@/components/ui/editor-icons"
import { cn } from "@/lib/class-names"
import { composing } from "@/lib/composing"

export function DeckTitleEdit({
  title,
  onRename,
  onTrash,
  className,
}: {
  title: string
  onTrash?: () => void
  onRename: (name: string) => void
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [words, setWords] = useState<string | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const renaming = useRef(false)
  const closed = useRef(false)
  const returnFocus = useRef(false)

  useEffect(() => {
    if (draft === null && returnFocus.current) {
      returnFocus.current = false
      trigger.current?.focus()
    }
  }, [draft])

  function close(restoreFocus = false) {
    returnFocus.current = restoreFocus
    closed.current = true
    setDraft(null)
    setWords(null)
  }

  function save(text: string, quiet: boolean) {
    if (closed.current) return
    const reading = nameReading(text)
    if (!reading.ok) {
      if (quiet) close()
      else setWords(reading.words)
      return
    }
    close(!quiet)
    if (reading.name !== title) onRename(reading.name)
  }

  function rename() {
    closed.current = false
    setDraft(title)
  }

  if (draft === null) {
    return (
      <span className={cn("flex min-w-0 items-center", className)}>
        <button
          ref={trigger}
          type="button"
          aria-label={`${productCopy.renameDeck}: ${title}`}
          onClick={rename}
          className="h-8 min-w-0 max-w-full truncate rounded-md px-1.5 text-[length:var(--type-dense)] font-medium text-foreground hover:bg-black/4"
        >
          {title}
        </button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            aria-label={deckActionsOf(title)}
            className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-black/4"
          >
            <EditorIcon name="chev" size={14} className="text-faint" />
          </DropdownMenuTrigger>
          <EditorMenuContent
            side="bottom"
            align={onTrash ? "start" : "end"}
            className={onTrash ? undefined : "w-fit min-w-28"}
            sideOffset={4}
            finalFocus={() => {
              if (!renaming.current) return true
              renaming.current = false
              return input.current
            }}
          >
            <DropdownMenuItem
              onClick={() => {
                renaming.current = true
                rename()
              }}
              className="h-8 gap-2.5 rounded-md py-0 pr-2.5 pl-2 text-[length:var(--type-dense)] text-white focus:bg-quiet focus:text-white focus:**:text-white"
            >
              {productCopy.rename}
            </DropdownMenuItem>
            {onTrash === undefined ? null : (
              <>
                <DropdownMenuSeparator className="mx-0 bg-quiet" />
                <DropdownMenuItem
                  onClick={onTrash}
                  className="h-8 gap-2.5 rounded-md py-0 pr-2.5 pl-2 text-[length:var(--type-dense)] text-white focus:bg-quiet focus:text-white focus:**:text-white"
                >
                  {productCopy.moveToTrash}
                </DropdownMenuItem>
              </>
            )}
          </EditorMenuContent>
        </DropdownMenu>
      </span>
    )
  }
  return (
    <span className={cn("relative flex min-w-0 flex-1", className)}>
      <input
        ref={input}
        autoFocus
        data-deck-name-field
        aria-label={productCopy.deckName}
        aria-invalid={words !== null}
        aria-describedby={words === null ? undefined : "deck-name-words"}
        value={draft}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
          setWords(null)
        }}
        onBlur={(event) => save(event.currentTarget.value, true)}
        onKeyDown={(event) => {
          if (composing(event)) return
          if (event.key === "Enter") {
            event.preventDefault()
            save(event.currentTarget.value, false)
          }
          if (event.key === "Escape") {
            event.preventDefault()
            close(true)
          }
        }}
        className="h-7 w-full min-w-0 flex-1 rounded-md bg-background px-1.5 [--focus-ring-offset:0px] text-[length:var(--type-dense)] font-medium text-foreground shadow-[0_0_0_1px_var(--field-edge)]"
      />
      {words === null ? null : (
        <span
          id="deck-name-words"
          role="alert"
          className="absolute top-8 left-0 z-10 w-max max-w-[220px] rounded-md bg-background px-2 py-1.5 text-[length:var(--type-dense)] leading-[var(--leading-body)] text-danger-text shadow-[0_0_0_1px_var(--field-edge),0_4px_12px_var(--black-6)]"
        >
          {words}
        </span>
      )}
    </span>
  )
}
