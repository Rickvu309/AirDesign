import { useRef, useState } from "react"
import { designCopy } from "@/copy/design-copy"
import { composing } from "@/lib/composing"
import { layerNameReading } from "./layer-name"

export function LayerName({ name, onRename }: { readonly name: string; readonly onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [words, setWords] = useState<string | null>(null)
  const closed = useRef(false)

  function close() {
    closed.current = true
    setDraft(null)
    setWords(null)
  }

  function save(text: string, quiet: boolean) {
    if (closed.current) return
    const reading = layerNameReading(text)
    if (!reading.ok) {
      if (quiet) close()
      else setWords(reading.words)
      return
    }
    close()
    if (reading.name !== name) onRename(reading.name)
  }

  if (draft === null) {
    return (
      <button
        type="button"
        data-layer-name
        aria-label={designCopy.renameLayer(name)}
        onClick={() => {
          closed.current = false
          setDraft(name)
        }}
        className="h-8 max-w-full truncate rounded-md px-1.5 text-left text-[length:var(--panel-title-size)] font-medium text-foreground hover:bg-black/4"
      >
        {name}
      </button>
    )
  }

  return (
    <span className="relative block min-w-0">
      <input
        autoFocus
        aria-label={designCopy.layerName}
        aria-invalid={words !== null}
        aria-describedby={words === null ? undefined : "layer-name-words"}
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
            close()
          }
        }}
        className="h-8 w-full min-w-0 rounded-md bg-background px-1.5 text-[length:var(--panel-title-size)] font-medium text-foreground shadow-[0_0_0_1px_var(--field-edge)] outline-none"
      />
      {words === null ? null : (
        <span
          id="layer-name-words"
          role="alert"
          className="absolute top-8 left-0 z-10 w-max max-w-[220px] rounded-md bg-background px-2 py-1.5 text-[length:var(--type-dense)] leading-[var(--leading-body)] text-danger-text shadow-[0_0_0_1px_var(--field-edge),0_4px_12px_var(--black-6)]"
        >
          {words}
        </span>
      )}
    </span>
  )
}
