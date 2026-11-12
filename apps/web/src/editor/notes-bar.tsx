import { useEffect, useRef, useState } from "react"

export function NotesBar({
  text,
  onEdit,
  locked,
}: {
  readonly text: string
  readonly onEdit?: (text: string) => void
  readonly locked?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(text)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(text)
  }, [text])
  return (
    <div className="pointer-events-auto flex flex-col gap-2" data-notes-bar>
      <button
        type="button"
        className="mx-auto flex h-3 w-12 items-center"
        aria-label={open ? "Collapse speaker notes" : "Expand speaker notes"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="block h-1 w-12 rounded-full bg-[var(--dot)]" />
      </button>
      {open ? (
        <div className="rounded-[var(--shape-card)] bg-line p-4">
          <label className="block text-[length:var(--type-dense)] text-quiet" htmlFor="speaker-notes">
            Speaker notes
          </label>
          <textarea
            id="speaker-notes"
            className="mt-2 block h-24 w-full resize-y bg-transparent text-[length:var(--type-dense)] text-quiet outline-none"
            value={draft}
            readOnly={onEdit === undefined}
            placeholder="Add speaker notes"
            onFocus={() => {
              focused.current = true
            }}
            onBlur={() => {
              focused.current = false
            }}
            onChange={(event) => {
              setDraft(event.target.value)
              onEdit?.(event.target.value)
            }}
          />
          {locked === undefined ? null : <p className="text-[length:var(--type-caption)] text-quiet">{locked}</p>}
        </div>
      ) : (
        <button
          type="button"
          className="flex h-12 w-full items-center rounded-[var(--shape-card)] bg-line px-4 text-left"
          aria-label="Expand speaker notes"
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          <span className="truncate text-[length:var(--type-dense)] text-quiet">
            {draft || locked || "Add speaker notes"}
          </span>
        </button>
      )}
    </div>
  )
}
