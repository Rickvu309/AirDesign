import { controlLabel } from "@/design/controls/control-label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { textCopy } from "@/copy/text-copy"
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { designCopy } from "@/copy/design-copy"
import type { ControlProps } from "@/design/panel"
import { EditorIcon } from "@/components/ui/editor-icons"
import { cn } from "@/lib/class-names"
import { clampedOf, shownInUnit, typedNumber } from "@/design/typed-number"
import { roundedShown, steppedFrom, untouched, type Shown } from "@/design/shown-number"
import { composing } from "@/lib/composing"

export function numberShown(control: ControlProps["control"], scale?: number): Shown {
  if (control.mixed || control.desc.kind !== "number" || typeof control.value !== "number") return roundedShown(null, 0)
  if (scale !== undefined) return roundedShown(control.value / scale, 2)
  return roundedShown(shownInUnit(control.desc.unit, control.value), 4)
}

export function storedFromTyped(control: ControlProps["control"], value: number): number | null {
  return clampedOf(control.desc, value)
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

export function scrubAfter(to: Scrub, landed: number): Scrub {
  return landed === to.value ? to : { value: landed, x: to.x }
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
  const Icon = look.name.show === "icon" ? look.name.icon : undefined
  const named = Icon !== undefined || look.name.show === "inside"
  const [draft, setDraft] = useState<string | null>(null)
  const held = numberShown(control, scale)
  const shown = held.text
  const field = useRef<HTMLInputElement>(null)
  const scrub = useRef<Scrub | null>(null)

  function readNumber(value: number) {
    return scale === undefined || control.desc.kind !== "number"
      ? storedFromTyped(control, value)
      : clampedOf({ ...control.desc, unit: "count" }, Math.round(value * scale))
  }

  function commit(text: string) {
    setDraft(null)
    if (untouched(text, held)) return
    const typed = typedNumber(text)
    if (typed === null || !Number.isFinite(typed)) return
    const read = readNumber(typed)
    if (read !== null && (read !== control.value || control.inherited)) onChange(read)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (composing(event)) return
    if (event.key === "Enter") commit(event.currentTarget.value)
    if (event.key === "Escape") setDraft(null)
    const moved = stepOf(event, step)
    if (moved === 0) return
    event.preventDefault()
    commit(String(steppedFrom(event.currentTarget.value, held, typedNumber) + moved))
  }

  function startScrub(event: PointerEvent<HTMLSpanElement>) {
    if (event.button !== 0 || shown === "") return
    event.preventDefault()
    field.current?.blur()
    field.current?.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    scrub.current = { value: held.exact ?? Number(shown), x: event.clientX }
  }

  function moveScrub(event: PointerEvent<HTMLSpanElement>) {
    const from = scrub.current
    if (from === null) return
    const to = scrubbed(from, event.clientX, event, step)
    if (to === from) return
    const read = readNumber(to.value)
    if (read === null) {
      scrub.current = { ...from, x: to.x }
      return
    }
    scrub.current = scrubAfter(to, Number(numberShown({ ...control, value: read }, scale).text))
    onChange(read)
  }

  function endScrub() {
    scrub.current = null
  }

  const suffix = size ? "" : unit
  const value = draft ?? shown
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
  ) : null
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

export const fontSizes = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 40, 48, 64, 96, 128] as const
