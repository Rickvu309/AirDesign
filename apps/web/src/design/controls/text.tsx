import { textCopy } from "@/copy/text-copy"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { fontNames } from "@airdesign/fonts"
import { servedFaces } from "@/design/served-faces"
import { useFaceFallback } from "@/design/face-fallback"
import { bytesOf } from "@airdesign/doom"
import { useId, useState } from "react"
import { designCopy } from "@/copy/design-copy"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"
import { composing } from "@/lib/composing"

function sizeOf(words: string): { readonly bytes: number; readonly wide: boolean } {
  let bytes = 0
  for (const letter of words) bytes += bytesOf(letter)
  return { bytes, wide: bytes > [...words].length }
}

function useTextProblem(words: string, max: number) {
  const problemId = useId()
  const size = sizeOf(words)
  const problem = size.bytes > max ? designCopy.tooLong(max, size.wide) : null
  const correction =
    problem === null ? null : (
      <p id={problemId} className="text-[length:var(--type-caption)] leading-[var(--leading-body)] text-danger-text">
        {problem}
      </p>
    )
  return { problemId, problem, correction }
}

function preloadFamily(typed: string): void {
  const family = fontNames.find((name) => name.toLowerCase() === typed.trim().toLowerCase())
  if (family !== undefined) servedFaces(family)
}

function WordsField({ control, onChange, max }: ControlProps & { readonly max: number }) {
  const font = control.trait === "text" && control.field === "font"
  const shown = typeof control.value === "string" ? control.value : ""
  const [draft, setDraft] = useState<string | null>(null)
  const { problemId, problem, correction } = useTextProblem((draft ?? shown).trim(), max)
  const awaitFaces = useFaceFallback(control, onChange)

  function commit(words: string) {
    if (problem !== null) return
    setDraft(null)
    const typed = words.trim()
    if (typed === "" || (typed === shown && !control.inherited)) return
    if (font) awaitFaces(typed)
    onChange(typed)
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        className="flex h-[var(--control-dense)] min-w-0 items-center gap-2 rounded-[var(--shape-control)] bg-white px-2 shadow-[inset_0px_0px_0px_1px_var(--field-edge)]"
        data-control="words"
        data-inherited={control.inherited ? "" : undefined}
        data-focus-ring
      >
        <span
          className={
            control.look.name.show === "hidden"
              ? "sr-only"
              : "shrink-0 truncate text-[length:var(--type-caption)] text-quiet"
          }
        >
          {control.label}
        </span>
        <input
          className={cn(
            "min-w-0 flex-1 bg-transparent text-[length:var(--type-caption)] outline-none",
            control.look.name.show === "hidden" ? "text-left" : "text-right",
            control.inherited && draft === null ? "text-quiet" : "text-foreground",
          )}
          aria-label={control.label}
          aria-invalid={problem !== null ? true : undefined}
          aria-describedby={problem !== null ? problemId : undefined}
          value={draft ?? shown}
          placeholder={control.mixed ? designCopy.mixed : undefined}
          onChange={(event) => {
            setDraft(event.target.value)
            if (font) preloadFamily(event.target.value)
          }}
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
        />
        {font ? (
          <Select
            value={shown}
            onValueChange={(value) => {
              if (value !== null) commit(value)
            }}
          >
            <SelectTrigger aria-label={textCopy.fonts} className="h-6 w-5 border-0 p-0 data-[size=default]:h-6" />
            <SelectContent className="max-h-80">
              {[...new Set([shown, ...fontNames])].filter(Boolean).map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </label>
      {correction}
    </div>
  )
}

export function TextControl(props: ControlProps) {
  const { desc } = props.control
  return desc.kind === "words" ? <WordsField {...props} max={desc.max} /> : null
}
