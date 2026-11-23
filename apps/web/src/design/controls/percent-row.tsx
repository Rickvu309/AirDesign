import { useState, type KeyboardEvent } from "react"
import { Slider } from "@/components/ui/slider"
import { roundedShown, untouched } from "@/design/shown-number"

export function PercentRow({
  label,
  exact,
  onCommit,
}: {
  label: string
  exact: number
  onCommit: (percent: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = roundedShown(exact, 0)
  function commit(text: string) {
    setDraft(null)
    if (untouched(text, shown)) return
    const typed = Number(text.trim().replace(",", "."))
    if (text.trim() === "" || !Number.isFinite(typed)) return
    onCommit(Math.min(100, Math.max(0, typed)))
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit(event.currentTarget.value)
    if (event.key === "Escape") setDraft(null)
  }
  return (
    <div className="flex h-[var(--control-dense)] items-center gap-2">
      <Slider
        label={label}
        valueText={(value) => `${String(value)}%`}
        min={0}
        max={100}
        step={1}
        value={Number(shown.text)}
        onValueChange={(value) => onCommit(Math.round(value))}
        className="min-w-0 flex-1"
      />
      <input
        className="w-12 bg-transparent text-right text-[length:var(--type-caption)] text-foreground tabular-nums outline-none"
        inputMode="decimal"
        aria-label={label}
        value={draft ?? shown.text}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          if (draft !== null) commit(event.currentTarget.value)
        }}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}
