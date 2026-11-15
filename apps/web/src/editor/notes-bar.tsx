import { useEffect, useRef, useState } from "react"

export function NotesBar({ text, onEdit }: { readonly text: string; readonly onEdit?: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)
  const expand = useRef<HTMLButtonElement>(null)
  const toggled = useRef(false)
  useEffect(() => {
    const box = field.current
    if (!open || box === null) {
      if (toggled.current) expand.current?.focus()
      return
    }
    if (toggled.current) {
      box.focus()
      box.setSelectionRange(box.value.length, box.value.length)
    }
    const refuse = (event: InputEvent) => {
      if (event.inputType.startsWith("history")) event.preventDefault()
    }
    box.addEventListener("beforeinput", refuse)
    return () => box.removeEventListener("beforeinput", refuse)
  }, [open])
  function toggle(next: boolean) {
    toggled.current = true
    setOpen(next)
  }
  return (
    <div className="pointer-events-auto" data-notes-bar>
      {open ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="mx-auto flex h-3 w-12 items-center"
            aria-label="Collapse speaker notes"
            aria-expanded
            onClick={() => toggle(false)}
          >
            <span className="block h-1 w-12 rounded-full bg-[var(--dot)]" />
          </button>
          <div className="rounded-[var(--shape-card)] bg-line p-4" data-focus-ring>
            <label className="block text-[length:var(--type-dense)] text-quiet" htmlFor="speaker-notes">
              Speaker notes
            </label>
            <textarea
              ref={field}
              id="speaker-notes"
              className="mt-2 block h-24 w-full resize-y bg-transparent text-[length:var(--type-dense)] text-ink outline-none placeholder:text-faint"
              value={text}
              readOnly={onEdit === undefined}
              placeholder="Add speaker notes"
              data-person-undo
              onChange={(event) => onEdit?.(event.target.value)}
            />
          </div>
        </div>
      ) : (
        <button
          ref={expand}
          type="button"
          className="flex w-full flex-col gap-2 text-left"
          aria-label="Expand speaker notes"
          aria-expanded={false}
          onClick={() => toggle(true)}
        >
          <span className="mx-auto flex h-3 w-12 items-center">
            <span className="block h-1 w-12 rounded-full bg-[var(--dot)]" />
          </span>
          <span className="flex h-12 w-full items-center rounded-[var(--shape-card)] bg-line px-4">
            <span className={`truncate text-[length:var(--type-dense)] ${text === "" ? "text-quiet" : "text-ink"}`}>
              {text || "Add speaker notes"}
            </span>
          </span>
        </button>
      )}
    </div>
  )
}
