import { agentNumberOf, readAgent } from "@airdesign/catalog"
import { useState, type KeyboardEvent } from "react"
import { designCopy } from "@/copy/design-copy"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

function shownNumber(row: ControlProps["row"]): string {
  if (row.mixed || row.desc.kind !== "number" || typeof row.value !== "number") return ""
  return String(agentNumberOf(row.desc.unit, row.value))
}

function stepOf(event: KeyboardEvent<HTMLInputElement>, unit: number): number {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return 0
  return (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 10 : 1) * unit
}

export function NumberField({
  row,
  onChange,
  unit,
  kind,
  step = 1,
}: ControlProps & { unit: string; kind: string; step?: number }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = shownNumber(row)

  function commit(text: string) {
    setDraft(null)
    const typed = Number(text.trim().replace(",", "."))
    if (text.trim() === "" || !Number.isFinite(typed)) return
    const read = readAgent(row.desc, typed)
    if (read.ok && (read.value !== row.value || row.inherited)) onChange(read.value)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit(event.currentTarget.value)
    if (event.key === "Escape") setDraft(null)
    const moved = stepOf(event, step)
    if (moved === 0) return
    event.preventDefault()
    const from = Number(event.currentTarget.value.replace(",", "."))
    commit(String((Number.isFinite(from) ? from : 0) + moved))
  }

  return (
    <label
      className="flex h-8 min-w-0 items-center gap-2 rounded-lg bg-white px-2.5 shadow-[0px_0px_0px_1px_var(--field-edge)]"
      data-control={kind}
      data-inherited={row.inherited ? "" : undefined}
      data-focus-ring
    >
      <span className="shrink-0 truncate text-[length:var(--type-caption)] text-quiet">{row.label}</span>
      <input
        className={cn(
          "min-w-0 flex-1 bg-transparent text-right text-[length:var(--type-dense)] tabular-nums outline-none placeholder:text-faint",
          row.inherited && draft === null ? "text-quiet" : "text-foreground",
        )}
        inputMode="decimal"
        aria-label={row.label}
        data-session
        placeholder={row.mixed ? designCopy.mixed : ""}
        value={draft ?? shown}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          if (draft !== null) commit(event.currentTarget.value)
        }}
        onKeyDown={onKeyDown}
      />
      <span className="shrink-0 text-[length:var(--type-caption)] text-quiet" aria-hidden>
        {unit}
      </span>
    </label>
  )
}
