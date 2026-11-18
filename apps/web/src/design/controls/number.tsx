import { ChevronDown } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { textCopy } from "@/copy/text-copy"
import { agentNumberOf, readAgent } from "@airdesign/catalog"
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { designCopy } from "@/copy/design-copy"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

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
  const Icon = look.name.show === "icon" ? look.name.icon : undefined
  const [draft, setDraft] = useState<string | null>(null)
  const shown = shownNumber(control, scale)
  const field = useRef<HTMLInputElement>(null)
  const scrub = useRef<Scrub | null>(null)

  function readNumber(value: number) {
    if (control.numberScale !== undefined) return readAgent(control.desc, value * control.numberScale)
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
      className={cn(
        "flex h-[var(--control-dense)] min-w-0 items-center gap-0.5 rounded-[var(--shape-control)] bg-muted pl-2",
        size ? "pr-0" : "pr-2",
      )}
      title={control.label}
      data-control={kind}
      data-inherited={control.inherited ? "" : undefined}
      data-focus-ring
    >
      <span
        className={cn(
          "min-w-0 shrink-0 truncate text-[length:var(--type-caption)] text-quiet",
          !size && "mr-2",
          (Icon !== undefined || look.name.show === "letter" || look.name.show === "inside") &&
            shown !== "" &&
            "cursor-ew-resize touch-none select-none",
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
      <input
        ref={field}
        className={cn(
          "min-w-[3ch] flex-1 bg-transparent text-right text-[length:var(--type-caption)] tabular-nums outline-none placeholder:text-quiet",
          (kind === "corners" || size) && "text-left",
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
      {size ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={textCopy.sizes}
            className="flex h-6 w-6 shrink-0 items-center justify-center border-l border-white"
          >
            <ChevronDown size={12} />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 overflow-y-auto">
            {fontSizes.map((value) => (
              <DropdownMenuItem key={value} onClick={() => commit(String(value))}>
                {value}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="shrink-0 text-[length:var(--type-caption)] text-quiet" aria-hidden>
          {unit}
        </span>
      )}
    </label>
  )
  return look.name.show === "above" ? (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span
        aria-hidden
        className={cn(
          "text-[length:var(--type-caption)] text-quiet",
          size && shown !== "" && "cursor-ew-resize touch-none select-none",
        )}
        onPointerDown={size ? startScrub : undefined}
        onPointerMove={size ? moveScrub : undefined}
        onPointerUp={size ? endScrub : undefined}
        onPointerCancel={size ? endScrub : undefined}
      >
        {size ? textCopy.size : control.label}
      </span>
      {view}
    </div>
  ) : (
    view
  )
}

export const fontSizes = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 40, 48, 64, 96, 128] as const
