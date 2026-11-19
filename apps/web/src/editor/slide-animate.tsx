import { useId, useState, type ReactNode } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"
import type { TransitionValue } from "@airdesign/document"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { airaRefusalWords } from "@/copy/aira-copy"
import { designCopy } from "@/copy/design-copy"
import { transitionCopy } from "@/copy/transition-copy"
import { DesignHead, DesignSection } from "@/editor/design-panel"
import {
  advanceOf,
  arrivalOf,
  directionOf,
  durationOf,
  millisecondsOf,
  secondsOf,
  styleOf,
  withDelay,
  withDirection,
  withDuration,
  withTiming,
  type ArrivalSide,
  type ArrivalStyle,
  type SlideArrival,
} from "@/editor/transition-value"

const field =
  "h-[var(--control-dense)] w-full rounded-[var(--shape-control)] border-0 bg-white px-2.5 text-[length:var(--type-caption)] shadow-[0px_0px_0px_1px_var(--field-edge)]"
const styles = ["none", "smartAnimate", "dissolve", "push", "moveIn", "moveOut"] as const
const sides = [
  ["left", ArrowLeft],
  ["right", ArrowRight],
  ["top", ArrowUp],
  ["bottom", ArrowDown],
] as const

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly (readonly [string, string])[]
  onChange: (value: string) => void
}): ReactNode {
  const named = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={named} className="text-[length:var(--type-caption)] text-quiet">
        {label}
      </span>
      <Select
        value={value}
        onValueChange={(next) => (typeof next === "string" && next !== value ? onChange(next) : undefined)}
      >
        <SelectTrigger aria-labelledby={named} className={field}>
          <SelectValue>{(selected: string | null) => options.find(([id]) => id === selected)?.[1] ?? ""}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function Seconds({
  label,
  ms,
  min,
  max,
  onCommit,
}: {
  label: string
  ms: number
  min: number
  max: number
  onCommit: (ms: number) => void
}): ReactNode {
  const named = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(secondsOf(ms))
  function commit(text: string) {
    const next = millisecondsOf(Number(text), min, max)
    setDraft(null)
    if (Number.isFinite(Number(text)) && next !== ms) onCommit(next)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label id={named} htmlFor={`${named}-seconds`} className="text-[length:var(--type-caption)] text-quiet">
        {label}
      </label>
      <span className="flex items-center gap-2">
        <input
          id={`${named}-seconds`}
          className={field}
          inputMode="decimal"
          value={shown}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit((event.target as HTMLInputElement).value)
          }}
        />
        <span className="text-[length:var(--type-caption)] text-quiet">{transitionCopy.seconds}</span>
      </span>
    </div>
  )
}

function delayOf(value: TransitionValue): number {
  const advance = advanceOf(value)
  return "delay" in advance ? advance.delay : 1000
}

export function SlideAnimate({
  arrival,
  head,
  onSet,
  onAll,
}: {
  arrival: SlideArrival | "mixed"
  head: string
  onSet: (value: TransitionValue) => void
  onAll: (value: TransitionValue) => void
}): ReactNode {
  const mixed = arrival === "mixed"
  const kept = !mixed && arrival.state === "kept"
  const value = !mixed && arrival.state === "value" ? arrival.value : null
  const style = mixed ? "mixed" : value === null ? "kept" : styleOf(value)
  const directed = value !== null && style !== "none" && style !== "dissolve" && style !== "smartAnimate"
  const styleOptions: (readonly [string, string])[] = [
    ...(mixed ? [["mixed", designCopy.mixed] as const] : []),
    ...(kept ? [["kept", transitionCopy.styles.kept] as const] : []),
    ...styles.map((id) => [id, transitionCopy.styles[id]] as const),
  ]
  const timing = value === null ? "click" : "delay" in advanceOf(value) ? "delay" : "click"
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-animate-panel>
      <DesignHead>{head}</DesignHead>
      <DesignSection title={transitionCopy.transition} last>
        <div className="flex flex-col gap-3">
          <Choice
            label={transitionCopy.style}
            value={style}
            options={styleOptions}
            onChange={(next) => {
              if ((styles as readonly string[]).includes(next)) onSet(arrivalOf(next as ArrivalStyle, value))
            }}
          />
          {kept ? (
            <p className="text-[length:var(--type-caption)] text-muted-foreground">{airaRefusalWords.kept}</p>
          ) : null}
          {directed && value !== null ? (
            <div className="flex flex-col gap-1.5" role="group" aria-label={transitionCopy.direction}>
              <span className="text-[length:var(--type-caption)] text-quiet">{transitionCopy.direction}</span>
              <span className="flex gap-1">
                {sides.map(([side, Icon]) => (
                  <button
                    key={side}
                    type="button"
                    aria-label={transitionCopy.sides[side]}
                    aria-pressed={directionOf(value) === side}
                    className={field + " grid size-8 w-8 place-items-center p-0"}
                    onClick={() => onSet(withDirection(value, side as ArrivalSide))}
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </span>
            </div>
          ) : null}
          {value !== null && style !== "none" ? (
            <Seconds
              label={transitionCopy.duration}
              ms={durationOf(value)}
              min={10}
              max={10_000}
              onCommit={(ms) => onSet(withDuration(value, ms))}
            />
          ) : null}
          {value !== null ? (
            <Choice
              label={transitionCopy.timing}
              value={timing}
              options={[
                ["click", transitionCopy.onClick],
                ["delay", transitionCopy.afterDelay],
              ]}
              onChange={(next) => (next === "click" || next === "delay" ? onSet(withTiming(value, next)) : undefined)}
            />
          ) : null}
          {value !== null && timing === "delay" ? (
            <Seconds
              label={transitionCopy.afterDelay}
              ms={delayOf(value)}
              min={0}
              max={86_400_000}
              onCommit={(ms) => onSet(withDelay(value, ms))}
            />
          ) : null}
          {kept || mixed ? null : (
            <button
              type="button"
              className="h-[var(--control-dense)] rounded-[var(--shape-control)] bg-white px-2.5 text-[length:var(--type-caption)] shadow-[0px_0px_0px_1px_var(--field-edge)]"
              onClick={() => {
                if (value !== null) onAll(value)
              }}
            >
              {transitionCopy.applyAll}
            </button>
          )}
        </div>
      </DesignSection>
    </div>
  )
}
