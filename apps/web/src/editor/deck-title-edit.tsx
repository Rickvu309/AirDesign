import { useEffect, useRef, useState } from "react"
import { productCopy } from "@/copy/product-copy"
import { nameReading } from "@/editor/deck-name-edit"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

export function DeckTitleEdit({
  title,
  onRename,
  className,
}: {
  title: string
  onRename: (name: string) => void
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [words, setWords] = useState<string | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
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

  if (draft === null) {
    return (
      <button
        ref={trigger}
        type="button"
        aria-label={`${productCopy.renameDeck}: ${title}`}
        onClick={() => {
          closed.current = false
          setDraft(title)
        }}
        className={cn("flex h-8 min-w-0 items-center gap-1 rounded-md px-1.5 hover:bg-black/4", className)}
      >
        <span className="truncate text-[length:var(--type-dense)] font-medium text-foreground">{title}</span>
        <EditorIcon name="chev" size={14} className="shrink-0 text-faint" />
      </button>
    )
  }
  return (
    <span className={cn("relative flex min-w-0 flex-1", className)}>
      <input
        autoFocus
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
          if (event.key === "Enter") {
            event.preventDefault()
            save(event.currentTarget.value, false)
          }
          if (event.key === "Escape") {
            event.preventDefault()
            close(true)
          }
        }}
        className="h-8 min-w-0 flex-1 rounded-md bg-background px-1.5 text-[length:var(--type-dense)] font-medium text-foreground shadow-[0_0_0_1px_var(--field-edge)] aria-invalid:shadow-[0_0_0_2px_var(--destructive)]"
      />
      {words === null ? null : (
        <span
          id="deck-name-words"
          role="alert"
          className="absolute top-9 left-0 z-10 w-max max-w-[220px] rounded-md bg-background px-2 py-1.5 text-[length:var(--type-dense)] leading-[var(--leading-body)] text-danger-text shadow-[0_0_0_1px_var(--field-edge),0_4px_12px_var(--black-6)]"
        >
          {words}
        </span>
      )}
    </span>
  )
}
