import { agentNumberOf, readAgent } from "@airdesign/catalog"
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { designCopy } from "@/copy/design-copy"
import type { ControlProps } from "@/design/panel"
import { NoneFill } from "@/design/preset-icons"
import { cn } from "@/lib/class-names"

function shownNumber(control: ControlProps["control"], scale?: number): string {
  if (control.mixed || control.desc.kind !== "number" || typeof control.value !== "number") return ""
  return String(
    scale === undefined
      ? agentNumberOf(control.desc.unit, control.value)
      : Math.round((control.value / scale) * 100) / 100,
  )
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
  control,
  onChange,
  unit,
  kind,
  step = 1,
  scale,
}: ControlProps & { unit: string; kind: string; step?: number; scale?: number }) {
  const look = control.look
  const borderWidth = ["border", "line"].includes(control.trait) && control.field === "width"
  const Icon = look.name.show === "icon" ? look.name.icon : borderWidth ? NoneFill : undefined
  const [draft, setDraft] = useState<string | null>(null)
  const shown = shownNumber(control, scale)
  const field = useRef<HTMLInputElement>(null)
  const scrub = useRef<Scrub | null>(null)

  function readNumber(value: number) {
    return scale === undefined || control.desc.kind !== "number"
      ? readAgent(control.desc, value)
      : readAgent({ ...control.desc, unit: "count" }, Math.round(value * scale))
  }

  function commit(text: string) {
    setDraft(null)
    const typed = Number(text.trim().replace(",", "."))
    if (text.trim() === "" || !Number.isFinite(typed)) return
    const read = readNumber(typed)
    if (read.ok && (read.value !== control.value || control.inherited)) onChange(read.value)
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
    const read = readNumber(to.value)
    scrub.current = read.ok ? to : { ...from, x: to.x }
    if (read.ok) onChange(read.value)
  }

  function endScrub() {
    scrub.current = null
  }

  const suffix = (control.trait === "text" && control.field === "size") || borderWidth ? "" : unit
  const value = draft ?? shown
  const view = (
    <label
      className="flex h-[var(--control-dense)] min-w-0 items-center gap-0 rounded-[var(--shape-control)] bg-[var(--panel-track)] px-2"
      title={control.label}
      data-control={kind}
      data-inherited={control.inherited ? "" : undefined}
      data-focus-ring
    >
      <span
        className={cn(
          "mr-2 min-w-0 shrink-0 truncate text-[length:var(--type-caption)] text-quiet",
          shown !== "" && "cursor-ew-resize touch-none select-none",
        )}
        onPointerDown={startScrub}
        onPointerMove={moveScrub}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
      >
        {Icon ? (
          <Icon size={14} className="size-3.5" strokeWidth={1.5} aria-hidden />
        ) : look.name.show === "letter" ? (
          look.name.letter
        ) : look.name.show === "inside" ? (
          control.label
        ) : null}
      </span>
      <span className="relative grid min-w-0 max-w-full">
        <span
          aria-hidden
          className="invisible col-start-1 row-start-1 whitespace-pre text-[length:var(--type-caption)] tabular-nums"
        >
          {value || (control.mixed ? designCopy.mixed : "   ")}
        </span>
        <input
          ref={field}
          className={cn(
            "absolute inset-0 w-full min-w-0 bg-transparent text-left text-[length:var(--type-caption)] tabular-nums outline-none placeholder:text-quiet",
            control.inherited && draft === null ? "text-quiet" : "text-foreground",
          )}
          inputMode="decimal"
          aria-label={control.label}
          data-session
          placeholder={control.mixed ? designCopy.mixed : ""}
          value={value}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            if (draft !== null) commit(event.currentTarget.value)
          }}
          onKeyDown={onKeyDown}
        />
      </span>
      <span className="shrink-0 text-[length:var(--type-caption)] text-foreground" aria-hidden>
        {suffix}
      </span>
    </label>
  )
  return look.name.show === "above" ? (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span aria-hidden className="text-[length:var(--type-caption)] text-quiet">
        {control.label}
      </span>
      {view}
    </div>
  ) : (
    view
  )
}
