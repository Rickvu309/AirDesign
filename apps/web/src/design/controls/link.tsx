import { readLinkAddress } from "@airdesign/doom"
import { EditorIcon } from "@/components/ui/editor-icons"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useId, useState } from "react"
import { linkCopy } from "@/copy/link-copy"
import type { ControlProps } from "@/design/panel"
import { composing } from "@/lib/composing"

type LinkTarget =
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "slide"; readonly slide: string }
  | { readonly kind: "none" }

function heldTarget(raw: unknown, slides: readonly string[]): LinkTarget | null {
  if (typeof raw !== "object" || raw === null || !("kind" in raw)) return null
  if (raw.kind === "slide" && "slide" in raw && typeof raw.slide === "string" && slides.includes(raw.slide))
    return { kind: "slide", slide: raw.slide }
  const url = raw.kind === "url" && "url" in raw ? readLinkAddress(raw.url) : undefined
  return url === undefined ? null : { kind: "url", url }
}

function typedTarget(text: string, slide: string | undefined): LinkTarget | null {
  if (slide !== undefined) return { kind: "slide", slide }
  if (text === "") return { kind: "none" }
  const typed = /^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(text)
    ? `mailto:${text}`
    : /^[\w.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(text)
      ? `https://${text}`
      : text
  const url = readLinkAddress(typed)
  return url === undefined ? null : { kind: "url", url }
}

export function LinkControl({ control, onChange }: ControlProps) {
  const slides = control.slides ?? []
  const value = heldTarget(control.value, slides)
  const shown = control.mixed
    ? linkCopy.mixed
    : value?.kind === "url"
      ? value.url
      : value?.kind === "slide"
        ? String(slides.indexOf(value.slide) + 1)
        : ""
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const issue = useId()

  function commit(words: string) {
    const text = words.trim()
    if (text === shown) {
      setDraft(null)
      return
    }
    const target = typedTarget(text, /^\d+$/.test(text) ? slides[Number(text) - 1] : undefined)
    if (target === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setDraft(null)
    onChange(target)
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        data-link-field
        data-focus-ring
        className="flex h-[var(--control-dense)] w-full rounded-[var(--shape-control)] bg-muted"
      >
        <input
          aria-label={control.label}
          placeholder={linkCopy.target}
          title={control.label}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? issue : undefined}
          className="h-full w-full min-w-0 rounded-l-[var(--shape-control)] bg-transparent px-2 text-[length:var(--type-caption)] outline-none"
          value={draft ?? shown}
          onChange={(event) => {
            setDraft(event.target.value)
            setInvalid(false)
          }}
          onBlur={(event) => {
            if (draft !== null) commit(event.target.value)
          }}
          onKeyDown={(event) => {
            if (composing(event)) return
            if (event.key === "Enter") {
              event.preventDefault()
              commit(event.currentTarget.value)
            }
            if (event.key === "Escape") {
              setDraft(null)
              setInvalid(false)
            }
          }}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            aria-label={linkCopy.slides}
            className="flex w-6 shrink-0 items-center justify-center border-l border-background"
          >
            <EditorIcon name="chev" size={12} />
          </DropdownMenuTrigger>
          <DropdownMenuContent data-keeps-format align="end" className="max-h-72 overflow-auto">
            {value?.kind === "url" ? (
              <DropdownMenuItem onClick={() => window.open(value.url, "_blank", "noopener,noreferrer")}>
                {linkCopy.open}
              </DropdownMenuItem>
            ) : null}
            {slides.map((slide, index) => (
              <DropdownMenuItem key={slide} onClick={() => commit(String(index + 1))}>
                {linkCopy.slide} {index + 1}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {invalid ? (
        <p id={issue} className="text-[length:var(--type-caption)] text-danger-text">
          {linkCopy.invalid}
        </p>
      ) : null}
    </div>
  )
}
