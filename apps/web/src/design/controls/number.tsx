import { agentNumberOf, readAgent } from "@airdesign/catalog"
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
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

export type Scrub = { readonly value: number; readonly x: number }

const scrubPixels = 2

export function scrubbed(
  scrub: Scrub,
  x: number,
  keys: { readonly shiftKey: boolean; readonly altKey: boolean },
  step: number,
): Scrub {
  const steps = Math.trunc((x - scrub.x) / scrubPixels)
  if (steps === 0) return scrub
  const each = keys.shiftKey ? step * 10 : keys.altKey ? step / 10 : step
  return { value: Math.round((scrub.value + steps * each) * 10) / 10, x: scrub.x + steps * scrubPixels }
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
  const field = useRef<HTMLInputElement>(null)
  const scrub = useRef<Scrub | null>(null)

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

  function startScrub(event: PointerEvent<HTMLSpanElement>) {
    if (event.button !== 0 || shown === "") return
    event.preventDefault()
    field.current?.blur()
    field.current?.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    scrub.current = { value: Number(shown), x: event.clientX }
  }

  function moveScrub(event: PointerEvent<HTMLSpanElement>) {
    const from = scrub.current
    if (from === null) return
    const to = scrubbed(from, event.clientX, event, step)
    if (to === from) return
    const read = readAgent(row.desc, to.value)
    scrub.current = read.ok ? to : { ...from, x: to.x }
    if (read.ok) onChange(read.value)
  }

  function endScrub() {
    scrub.current = null
  }

  return (
    <label
      className="flex h-8 min-w-0 items-center gap-2 rounded-[var(--shape-control)] bg-muted px-2.5"
      data-control={kind}
      data-inherited={row.inherited ? "" : undefined}
      data-focus-ring
    >
      <span
        className={cn(
          "min-w-0 truncate text-[length:var(--type-caption)] text-quiet",
          shown !== "" && "cursor-ew-resize touch-none select-none",
        )}
        onPointerDown={startScrub}
        onPointerMove={moveScrub}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
      >
        {row.label}
      </span>
      <input
        ref={field}
        className={cn(
          "min-w-[3ch] flex-1 bg-transparent text-right text-[length:var(--type-dense)] tabular-nums outline-none placeholder:text-quiet",
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
