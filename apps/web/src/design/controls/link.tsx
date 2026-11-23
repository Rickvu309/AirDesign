import { readLinkTarget, slideId, type LinkEdit } from "@airdesign/document"
import type { TextFormatting } from "@airdesign/render"
import { EditorIcon } from "@/components/ui/editor-icons"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { createContext, useContext, useId, useState, useSyncExternalStore } from "react"
import { linkCopy } from "@/copy/link-copy"
import type { ControlProps } from "@/design/panel"

export const LinkFormatting = createContext<TextFormatting | undefined>(undefined)
const noop = () => () => undefined

function heldTarget(raw: unknown, slides: readonly string[]): LinkEdit | null {
  const slide =
    typeof raw === "object" && raw !== null && "kind" in raw && raw.kind === "slide" && "slide" in raw
      ? raw.slide
      : undefined
  return typeof slide === "string" && slides.includes(slide)
    ? { kind: "slide", slide: slideId(slide) }
    : readLinkTarget(raw)
}

export function LinkControl({ control, onChange }: ControlProps) {
  const formatting = useContext(LinkFormatting)
  useSyncExternalStore(
    formatting?.subscribe ?? noop,
    () => JSON.stringify([formatting?.selection(), formatting?.link()]),
    () => "",
  )
  const selection = formatting?.selection() === true
  const current = selection ? formatting?.link() : control.value
  const slides = control.slides ?? []
  const value = heldTarget(current, slides)
  const unsupported =
    typeof current === "object" && current !== null && "kind" in current && current.kind === "unsupported"
  const shown =
    current === "mixed" || control.mixed
      ? linkCopy.mixed
      : unsupported
        ? linkCopy.unsupported
        : value?.kind === "url"
          ? value.url
          : value?.kind === "slide"
            ? String(slides.indexOf(value.slide) + 1 || "")
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
    const slide = /^\d+$/.test(text) ? slides[Number(text) - 1] : undefined
    const url = /^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(text)
      ? `mailto:${text}`
      : /^[\w.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(text)
        ? `https://${text}`
        : text
    const target: LinkEdit | null =
      slide === undefined
        ? readLinkTarget(text === "" ? { kind: "none" } : { kind: "url", url })
        : { kind: "slide", slide: slideId(slide) }
    if (target === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setDraft(null)
    if (selection) formatting?.linkTo(target)
    else onChange(target)
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
          placeholder={unsupported ? linkCopy.unsupported : linkCopy.target}
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
            if (event.nativeEvent.isComposing) return
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
