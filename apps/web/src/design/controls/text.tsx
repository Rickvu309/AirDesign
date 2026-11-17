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

function wordsOf(row: ControlProps["row"]): string {
  const value = typeof row.value === "string" ? row.value : ""
  return row.desc.kind === "text" ? cellText(readTextValue(value) ?? []) : value
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

function WordsField({ row, onChange, max }: ControlProps & { readonly max: number }) {
  const shown = typeof row.value === "string" ? row.value : ""
  const [draft, setDraft] = useState<string | null>(null)
  const { problemId, problem, correction } = useTextProblem((draft ?? shown).trim(), max)

  function commit(words: string) {
    if (problem !== null) return
    setDraft(null)
    const typed = words.trim()
    if (typed !== "" && (typed !== shown || row.inherited)) onChange(typed)
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        className="flex h-8 min-w-0 items-center gap-2 rounded-lg bg-white px-2.5 shadow-[0px_0px_0px_1px_var(--field-edge)] has-[[aria-invalid=true]]:shadow-[0px_0px_0px_2px_var(--destructive)]"
        data-control="words"
        data-inherited={row.inherited ? "" : undefined}
        data-focus-ring
      >
        <span className="shrink-0 truncate text-[length:var(--type-caption)] text-quiet">{row.label}</span>
        <input
          className={cn(
            "min-w-0 flex-1 bg-transparent text-right text-[length:var(--type-dense)] outline-none",
            row.inherited && draft === null ? "text-quiet" : "text-foreground",
          )}
          aria-label={row.label}
          aria-invalid={problem !== null ? true : undefined}
          aria-describedby={problem !== null ? problemId : undefined}
          value={draft ?? shown}
          onChange={(event) => setDraft(event.target.value)}
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
      </label>
      {correction}
    </div>
  )
}

export function TextControl(props: ControlProps) {
  return props.row.desc.kind === "words" ? (
    <WordsField {...props} max={props.row.desc.max} />
  ) : (
    <PassageField {...props} />
  )
}

function PassageField({ row, onChange }: ControlProps) {
  const label = useId()
  const shown = wordsOf(row)
  const [draft, setDraft] = useState<string | null>(null)

  const value = typeof row.value === "string" ? row.value : ""
  const stored = (words: string) => (row.desc.kind === "text" ? typedText(value, words) : words)
  const { problemId, problem, correction } = useTextProblem(
    stored(draft ?? shown),
    limits.valueBytes,
    designCopy.textTooLong,
  )

  function commit(words: string) {
    if (problem !== null) return
    setDraft(null)
    if (words !== shown) onChange(stored(words))
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === "Escape") setDraft(null)
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) commit(event.currentTarget.value)
  }

  return (
    <div className="flex flex-col gap-1" data-control="text">
      <label htmlFor={label} className="sr-only">
        {row.label}
      </label>
      <Textarea
        id={label}
        aria-invalid={problem !== null ? true : undefined}
        aria-describedby={problem !== null ? problemId : undefined}
        rows={2}
        className="max-h-40 min-h-16 resize-none border-0 bg-white text-[length:var(--type-dense)] shadow-[0px_0px_0px_1px_var(--field-edge)] aria-invalid:shadow-[0px_0px_0px_2px_var(--destructive)] md:text-[length:var(--type-dense)]"
        value={draft ?? shown}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          if (draft !== null) commit(event.currentTarget.value)
        }}
        onKeyDown={onKeyDown}
      />
      {correction}
    </div>
  )
}
