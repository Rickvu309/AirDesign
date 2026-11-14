import { agentNumberOf, readAgent } from "@airdesign/catalog"
import { useState, type KeyboardEvent } from "react"
import { designCopy } from "@/copy/design-copy"
import type { ControlProps } from "@/design/panel"

function shownPoints(row: ControlProps["row"]): string {
  if (row.mixed || row.desc.kind !== "number" || typeof row.value !== "number") return ""
  return String(agentNumberOf(row.desc.unit, row.value))
}

function stepOf(event: KeyboardEvent<HTMLInputElement>): number {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return 0
  return (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 10 : 1)
}

export function LengthControl({ row, onChange }: ControlProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = shownPoints(row)

  function commit(text: string) {
    setDraft(null)
    const points = Number(text.trim().replace(",", "."))
    if (text.trim() === "" || !Number.isFinite(points)) return
    const read = readAgent(row.desc, points)
    if (read.ok && read.value !== row.value) onChange(read.value)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit(event.currentTarget.value)
    if (event.key === "Escape") setDraft(null)
    const step = stepOf(event)
    if (step === 0) return
    event.preventDefault()
    const from = Number(event.currentTarget.value.replace(",", "."))
    commit(String((Number.isFinite(from) ? from : 0) + step))
  }

  return (
    <label
      className="flex h-8 min-w-0 items-center gap-2 rounded-lg bg-white px-2.5 shadow-[0px_0px_0px_1px_var(--field-edge)]"
      data-control="length"
      data-focus-ring
    >
      <span className="shrink-0 text-[length:var(--type-caption)] text-quiet">{row.label}</span>
      <input
        className="min-w-0 flex-1 bg-transparent text-right text-[length:var(--type-dense)] text-foreground tabular-nums outline-none placeholder:text-faint"
        inputMode="decimal"
        aria-label={row.label}
        placeholder={row.mixed ? designCopy.mixed : ""}
        value={draft ?? shown}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          if (draft !== null) commit(event.currentTarget.value)
        }}
        onKeyDown={onKeyDown}
      />
      <span className="shrink-0 text-[length:var(--type-caption)] text-quiet" aria-hidden>
        {designCopy.points}
      </span>
    </label>
  )
}
