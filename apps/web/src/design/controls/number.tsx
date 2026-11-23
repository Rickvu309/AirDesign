import { controlLabel } from "@/design/controls/control-label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { textCopy } from "@/copy/text-copy"
import { agentNumberOf, readAgent } from "@airdesign/catalog"
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { designCopy } from "@/copy/design-copy"
import type { ControlProps } from "@/design/panel"
import { NoneFill, Opacity } from "@/design/preset-icons"
import { EditorIcon } from "@/components/ui/editor-icons"
import { cn } from "@/lib/class-names"
import { lineHeightPointsFloor, spaceCeiling } from "@airdesign/document"
import { fixedLine, typedFixed, typedNumber } from "@/design/typed-number"

export function chosenStep(shown: string, steps: readonly number[]): number | null {
  const value = Number(shown.trim().replace(",", "."))
  if (shown.trim() === "" || !Number.isFinite(value)) return null
  return steps.find((step) => step === value) ?? null
}

function shownNumber(control: ControlProps["control"], scale?: number): string {
  if (control.mixed || control.desc.kind !== "number" || typeof control.value !== "number") return ""
  if (scale !== undefined) return String(Math.round((control.value / scale) * 100) / 100)
  const shown =
    control.numberScale === undefined
      ? agentNumberOf(control.desc.unit, control.value)
      : control.value / 100 / control.numberScale
  return String(Math.round(shown * 10000) / 10000)
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

const listTrigger =
  "ml-auto flex h-full w-6 shrink-0 items-center justify-center rounded-r-[var(--shape-control)] border-l border-white text-foreground outline-none"

export function NumberField({
  control,
  onChange,
  unit,
  kind,
  step = 1,
  scale,
}: ControlProps & { unit: string; kind: string; step?: number; scale?: number }) {
  const size = control.trait === "text" && control.field === "size"
  const look = control.look
  const borderWidth = control.trait === "border" && control.field === "width"
  const Icon =
    look.glyph ??
    (look.name.show === "icon"
      ? look.name.icon
      : borderWidth
        ? NoneFill
        : control.trait === "opacity"
          ? Opacity
          : undefined)
  const named = Icon !== undefined || look.name.show === "letter" || look.name.show === "inside"
  const [draft, setDraft] = useState<string | null>(null)
  const fixed = fixedLine(control.value)
  const shown = fixed === null ? shownNumber(control, scale) : String(fixed.points / 100)
  const typedUnit = control.typed ?? {}
  const auto = fixed === null && typedUnit.auto !== undefined && shown !== "" && Number(shown) === typedUnit.auto
  const field = useRef<HTMLInputElement>(null)
  const scrub = useRef<Scrub | null>(null)

  function readNumber(value: number) {
    if (control.numberScale !== undefined) return readAgent(control.desc, value * control.numberScale)
    return scale === undefined || control.desc.kind !== "number"
      ? readAgent(control.desc, value)
      : readAgent({ ...control.desc, unit: "count" }, Math.round(value * scale))
  }

  function commitFixed(points: number) {
    if (points < lineHeightPointsFloor || points > spaceCeiling) return
    if (points !== fixed?.points || control.inherited) onChange({ points })
  }

  function commit(text: string) {
    setDraft(null)
    const points = typedFixed(text, typedUnit, fixed !== null)
    if (points !== null) {
      commitFixed(points)
      return
    }
    const typed = typedNumber(text, typedUnit)
    if (typed === null || !Number.isFinite(typed)) return
    const read = readNumber(typed)
    if (read.ok && (read.value !== control.value || control.inherited)) onChange(read.value)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit(event.currentTarget.value)
    if (event.key === "Escape") setDraft(null)
    const moved = stepOf(event, step)
    if (moved === 0) return
    event.preventDefault()
    const from = typedNumber(event.currentTarget.value, typedUnit) ?? 0
    commit(String(from + moved))
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
    if (fixed !== null) {
      scrub.current = to
      commitFixed(Math.round(to.value * 100))
      return
    }
    const read = readNumber(to.value)
    scrub.current = read.ok ? to : { ...from, x: to.x }
    if (read.ok) onChange(read.value)
  }

  function endScrub() {
    scrub.current = null
  }

  const suffix =
    size || borderWidth || unit === "" || (auto && draft === null) ? "" : fixed === null ? unit : designCopy.points
  const value = draft ?? (auto ? textCopy.auto : shown)
  const steps = look.steps
  const list = size ? (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={textCopy.sizes} className={listTrigger} data-focus-ring>
        <EditorIcon name="chev" size={12} className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 overflow-y-auto">
        {fontSizes.map((sizeValue) => (
          <DropdownMenuItem key={sizeValue} onClick={() => commit(String(sizeValue))}>
            {sizeValue}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : steps === undefined ? null : (
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
  )
  const row = (
    <label
      className={cn(
        "flex h-[var(--control-dense)] w-full min-w-0 items-center gap-0 rounded-[var(--shape-control)] bg-[var(--panel-track)] pl-2",
        list === null ? "pr-2" : "pr-0",
      )}
      title={look.name.show === "hidden" ? undefined : control.label}
      data-control={kind}
      data-inherited={control.inherited ? "" : undefined}
      data-focus-ring
    >
      {named ? (
        <span
          className={cn(
            "mr-2 min-w-0 truncate text-[length:var(--type-caption)] text-quiet",
            look.name.show === "inside" ? "shrink" : "shrink-0",
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
      <span className={cn("relative grid min-w-0 max-w-full", look.name.show === "inside" && "shrink-0")}>
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
      {suffix === "" ? null : (
        <span className="shrink-0 text-[length:var(--type-caption)] text-foreground" aria-hidden>
          {suffix}
        </span>
      )}
      {list}
    </label>
  )
  return look.name.show === "above" ? (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        aria-hidden
        className={cn(controlLabel, size && shown !== "" && "cursor-ew-resize touch-none select-none")}
        onPointerDown={size ? startScrub : undefined}
        onPointerMove={size ? moveScrub : undefined}
        onPointerUp={size ? endScrub : undefined}
        onPointerCancel={size ? endScrub : undefined}
      >
        {size ? textCopy.size : control.label}
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
      <PopoverTrigger render={<button type="button" aria-label={label} className={listTrigger} data-focus-ring />}>
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

export const fontSizes = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 40, 48, 64, 96, 128] as const
