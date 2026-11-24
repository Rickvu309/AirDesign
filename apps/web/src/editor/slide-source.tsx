import { bytesOf, limits } from "@airdesign/doom"
import { useEffect, useRef, useState } from "react"
import { designCopy } from "@/copy/design-copy"
import { DesignSection } from "@/editor/design-sections"
import { composing } from "@/lib/composing"

function fitted(words: string): string {
  let kept = words.trim()
  while (bytesOf(kept) > limits.source) kept = kept.slice(0, -1)
  return kept
}

export function SlideSource({
  source,
  asked,
  onSource,
}: {
  readonly source: string
  readonly asked: number
  readonly onSource: (source: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (asked === 0) return
    field.current?.focus()
    field.current?.select()
  }, [asked])

  function commit(words: string) {
    setDraft(null)
    const typed = fitted(words)
    if (typed !== source) onSource(typed)
  }

  return (
    <DesignSection title={designCopy.source}>
      <label
        data-focus-ring
        className="flex h-[var(--control-dense)] min-w-0 items-center rounded-[var(--shape-control)] bg-white px-2 shadow-[inset_0px_0px_0px_1px_var(--field-edge)]"
      >
        <input
          ref={field}
          data-slide-source=""
          aria-label={designCopy.source}
          value={draft ?? source}
          placeholder={designCopy.sourceExample}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={(event) => {
            if (draft !== null) commit(event.currentTarget.value)
          }}
          onKeyDown={(event) => {
            if (composing(event)) return
            if (event.key === "Enter") {
              event.preventDefault()
              commit(event.currentTarget.value)
            }
            if (event.key === "Escape") setDraft(null)
          }}
          className="min-w-0 flex-1 bg-transparent text-[length:var(--type-caption)] text-foreground outline-none placeholder:text-quiet"
        />
      </label>
    </DesignSection>
  )
}
