import { cellText, readTextValue, writeTextValue, type TextRun, type TextValue } from "@airdesign/document"
import { useId, useState, type KeyboardEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import type { ControlProps } from "@/design/panel"

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

export function TextControl({ row, onChange }: ControlProps) {
  const label = useId()
  const shown = wordsOf(row)
  const [draft, setDraft] = useState<string | null>(null)

  function commit(words: string) {
    setDraft(null)
    if (words === shown) return
    const value = typeof row.value === "string" ? row.value : ""
    onChange(row.desc.kind === "text" ? typedText(value, words) : words)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") setDraft(null)
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) commit(event.currentTarget.value)
  }

  return (
    <div className="flex flex-col" data-control="text">
      <label htmlFor={label} className="sr-only">
        {row.label}
      </label>
      <Textarea
        id={label}
        rows={2}
        className="max-h-40 min-h-16 resize-none border-0 bg-white text-[length:var(--type-dense)] shadow-[0px_0px_0px_1px_var(--field-edge)] md:text-[length:var(--type-dense)]"
        value={draft ?? shown}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          if (draft !== null) commit(event.currentTarget.value)
        }}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}
