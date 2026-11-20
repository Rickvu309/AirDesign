import { textCopy } from "@/copy/text-copy"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { fontNames } from "@airdesign/fonts"
import { servedFaces } from "@/design/served-faces"
import {
  bytesOf,
  cellText,
  limits,
  readTextValue,
  writeTextValue,
  type TextRun,
  type TextValue,
} from "@airdesign/document"
import { useId, useState, type KeyboardEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import { designCopy } from "@/copy/design-copy"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

function styleOf(run: TextRun | undefined): Omit<TextRun, "from" | "text"> {
  if (run === undefined) return {}
  const { from: _from, text: _text, ...style } = run
  return style
}

export function typedText(value: string, words: string): string {
  const before: TextValue = readTextValue(value) ?? []
  const typed = words.split("\n").map((line, at) => {
    const source = before[Math.min(at, before.length - 1)]
    const { runs = [], ...paragraph } = source ?? { from: 0 }
    const from = runs[0]?.from ?? -1
    return {
      ...paragraph,
      from: source?.from ?? 0,
      runs: line === "" ? [] : [{ ...styleOf(runs[0]), from, text: line }],
    }
  })
  return writeTextValue(typed)
}

export function passageWords(value: string): string {
  return cellText(readTextValue(value) ?? [{ from: 0, runs: [{ from: 0, text: value }] }])
}

function sizeOf(words: string): { readonly bytes: number; readonly wide: boolean } {
  let bytes = 0
  for (const letter of words) bytes += bytesOf(letter)
  return { bytes, wide: bytes > [...words].length }
}

function useTextProblem(words: string, max: number, message = designCopy.tooLong) {
  const problemId = useId()
  const size = sizeOf(words)
  const problem = size.bytes > max ? message(max, size.wide) : null
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

  function commit(words: string) {
    if (problem !== null) return
    setDraft(null)
    const typed = words.trim()
    if (typed !== "" && (typed !== shown || control.inherited)) onChange(typed)
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        className="flex h-[var(--control-dense)] min-w-0 items-center gap-2 rounded-[var(--shape-control)] bg-white px-2 shadow-[inset_0px_0px_0px_1px_var(--field-edge)] has-[[aria-invalid=true]]:shadow-[0px_0px_0px_2px_var(--destructive)]"
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
            if (event.nativeEvent.isComposing) return
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
  const { control, onChange } = props
  if (control.desc.kind === "words") return <WordsField {...props} max={control.desc.max} />
  const value = typeof control.value === "string" ? control.value : ""
  const rich = control.desc.kind === "text"
  return (
    <PassageField
      label={control.label}
      values={[value]}
      rich={rich}
      onChange={(words) => onChange(rich ? typedText(value, words) : words)}
    />
  )
}

export function PassageField({
  label,
  values,
  rich,
  onChange,
}: {
  readonly label: string
  readonly values: readonly string[]
  readonly rich: boolean
  readonly onChange: (words: string) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const shown = values.map((value) => (rich ? passageWords(value) : value))
  const first = shown[0] ?? ""
  const mixed = shown.some((value) => value !== first)
  const words = draft ?? (mixed ? "" : first)
  const largest = values.reduce((longest, value) => {
    const stored = rich ? typedText(value, words) : words
    return bytesOf(stored) > bytesOf(longest) ? stored : longest
  }, "")
  const { problemId, problem, correction } = useTextProblem(largest, limits.valueBytes, designCopy.textTooLong)

  function commit() {
    if (draft === null || problem !== null) return
    setDraft(null)
    if (mixed || draft !== first) onChange(draft)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === "Escape") {
      event.stopPropagation()
      setDraft(null)
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      commit()
    }
  }

  return (
    <div className="flex flex-col gap-1" data-control="text">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Textarea
        id={id}
        aria-invalid={problem !== null ? true : undefined}
        aria-describedby={problem !== null ? problemId : undefined}
        rows={2}
        className="max-h-40 min-h-16 resize-none bg-white text-[length:var(--type-caption)] md:text-[length:var(--type-caption)]"
        value={words}
        placeholder={mixed ? designCopy.mixed : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      {correction}
    </div>
  )
}
