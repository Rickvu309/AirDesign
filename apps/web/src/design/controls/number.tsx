import { agentNumberOf, readAgent } from "@airdesign/catalog"
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { designCopy } from "@/copy/design-copy"
import type { ControlProps } from "@/design/panel"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

export function chosenStep(shown: string, steps: readonly number[]): number | null {
  const value = Number(shown.trim().replace(",", "."))
  if (shown.trim() === "" || !Number.isFinite(value)) return null
  return steps.find((step) => step === value) ?? null
}

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
  const Icon = look.glyph ?? (look.name.show === "icon" ? look.name.icon : undefined)
  const named = Icon !== undefined || look.name.show === "letter" || look.name.show === "inside"
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

  const view = (
    <label
      className="flex h-[var(--control-dense)] min-w-0 items-center gap-0.5 rounded-[var(--shape-control)] bg-muted px-2"
      title={look.name.show === "hidden" ? undefined : control.label}
      data-control={kind}
      data-inherited={control.inherited ? "" : undefined}
      data-focus-ring
    >
      {named ? (
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
      ) : null}
      <input
        ref={field}
        className={cn(
          "min-w-[3ch] flex-1 bg-transparent text-right text-[length:var(--type-caption)] tabular-nums outline-none placeholder:text-quiet",
          kind === "corners" && "text-left",
          control.inherited && draft === null ? "text-quiet" : "text-foreground",
        )}
        inputMode="decimal"
        aria-label={control.label}
        data-session
        placeholder={control.mixed ? designCopy.mixed : ""}
        value={draft ?? shown}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          if (draft !== null) commit(event.currentTarget.value)
        }}
        onKeyDown={onKeyDown}
      />
      {unit === "" ? null : (
        <span className="shrink-0 text-[length:var(--type-caption)] text-quiet" aria-hidden>
          {unit}
        </span>
      )}
    </label>
  )
  const steps = look.steps
  const row =
    steps === undefined ? (
      view
    ) : (
      <div className="flex min-w-0 items-center gap-1">
        {view}
        <StepList
          label={designCopy.list(control.label)}
          steps={steps}
          unit={unit}
          shown={shown}
          onPick={(step) => {
            const read = readNumber(step)
            if (read.ok && (read.value !== control.value || control.inherited)) onChange(read.value)
          }}
        />
      </div>
    )
  return look.name.show === "above" ? (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span aria-hidden className="text-[length:var(--type-caption)] text-quiet">
        {control.label}
      </span>
      {row}
    </div>
  ) : (
    row
  )
}

function StepList({
  label,
  steps,
  unit,
  shown,
  onPick,
}: {
  label: string
  steps: readonly number[]
  unit: string
  shown: string
  onPick: (step: number) => void
}) {
  const [open, setOpen] = useState(false)
  const chosen = chosenStep(shown, steps)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className="flex h-[var(--control-dense)] w-6 shrink-0 items-center justify-center rounded-[var(--shape-control)] bg-muted text-quiet"
            data-focus-ring
          />
        }
      >
        <EditorIcon name="chev" size={12} className="size-3" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto min-w-24 gap-0 p-1 duration-0">
        <div role="listbox" aria-label={label} className="flex flex-col">
          {steps.map((step) => (
            <button
              key={step}
              type="button"
              role="option"
              aria-selected={chosen === step}
              className="rounded-[var(--shape-control)] px-2 py-1 text-left text-[length:var(--type-caption)] tabular-nums hover:bg-muted"
              onClick={() => {
                setOpen(false)
                onPick(step)
              }}
            >
              {String(step)}
              {unit}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
