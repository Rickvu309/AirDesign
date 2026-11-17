import { readLinkTarget } from "@airdesign/document"
import { useState } from "react"
import { linkCopy } from "@/copy/link-copy"
import type { ControlProps } from "@/design/panel"

export function LinkControl({ control, onChange }: ControlProps) {
  const value = readLinkTarget(control.value)
  const slides = control.slides ?? []
  const unsupported =
    typeof control.value === "object" &&
    control.value !== null &&
    "kind" in control.value &&
    control.value.kind === "unsupported"
  const shown = unsupported
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
    const target = readLinkTarget(
      text === "" ? { kind: "none" } : slide === undefined ? { kind: "url", url: text } : { kind: "slide", slide },
    )
    if (target === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setDraft(null)
    onChange(target)
  }

  return (
    <input
      aria-label={control.label}
      placeholder={unsupported ? linkCopy.unsupported : linkCopy.target}
      title={invalid ? linkCopy.invalid : control.label}
      aria-invalid={invalid || undefined}
      className="h-[var(--control-dense)] w-full min-w-0 rounded-[var(--shape-control)] bg-muted px-2 text-[length:var(--type-caption)] focus:shadow-[0px_0px_0px_1px_var(--field-edge)]"
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
  )
}
