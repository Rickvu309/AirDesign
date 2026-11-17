import { readLinkTarget } from "@airdesign/document"
import type { TextFormatting } from "@airdesign/render"
import { EditorIcon } from "@/editor/editor-icons"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { createContext, useContext, useState, useSyncExternalStore } from "react"
import { linkCopy } from "@/copy/link-copy"
import type { ControlProps } from "@/design/panel"

export const LinkFormatting = createContext<TextFormatting | undefined>(undefined)
const noop = () => () => undefined

export function LinkControl({ control, onChange }: ControlProps) {
  const formatting = useContext(LinkFormatting)
  useSyncExternalStore(
    formatting?.subscribe ?? noop,
    () => JSON.stringify([formatting?.selection(), formatting?.link()]),
    () => "",
  )
  const selection = formatting?.selection() === true
  const current = selection ? formatting?.link() : control.value
  const value = readLinkTarget(current)
  const slides = control.slides ?? []
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

  function commit(words: string) {
    const text = words.trim()
    if (text === shown) {
      setDraft(null)
      return
    }
    const slide = /^\d+$/.test(text) ? slides[Number(text) - 1] : undefined
    const url = /^[\w.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(text) ? `https://${text}` : text
    const target = readLinkTarget(
      text === "" ? { kind: "none" } : slide === undefined ? { kind: "url", url } : { kind: "slide", slide },
    )
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
    <div className="flex h-[var(--control-dense)] w-full rounded-[var(--shape-control)] bg-muted">
      <input
        aria-label={control.label}
        placeholder={unsupported ? linkCopy.unsupported : linkCopy.target}
        title={invalid ? linkCopy.invalid : control.label}
        aria-invalid={invalid || undefined}
        className="h-full w-full min-w-0 rounded-l-[var(--shape-control)] bg-transparent px-2 text-[length:var(--type-caption)]"
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
  )
}
