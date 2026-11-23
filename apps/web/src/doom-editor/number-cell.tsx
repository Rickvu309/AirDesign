import { useId } from "react"
import { cn } from "@/lib/class-names"
import { roundedShown, steppedFrom, untouched } from "@/design/shown-number"

export function NumberField(props: {
  readonly label: string
  readonly value: number | undefined
  readonly mixed?: boolean
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly suffix?: string
  readonly hideLabel?: boolean
  readonly onCommit: (value: number) => void
}) {
  const id = useId()
  const shown = roundedShown(props.value, 2)
  const read = (text: string) => (text.trim() === "" || !Number.isFinite(Number(text)) ? null : Number(text))
  return (
    <form
      data-focus-ring
      className="flex h-8 items-center gap-1.5 rounded-lg bg-muted px-2.5"
      onSubmit={(event) => {
        event.preventDefault()
        event.currentTarget.querySelector("input")?.blur()
      }}
    >
      <label
        htmlFor={id}
        className={cn(props.hideLabel === true ? "sr-only" : "shrink-0 text-[length:var(--type-caption)] text-quiet")}
      >
        {props.label}
      </label>
      <input
        key={`${shown.text}|${String(props.mixed)}`}
        id={id}
        type="number"
        inputMode="decimal"
        defaultValue={props.mixed === true ? "" : shown.text}
        placeholder={props.mixed === true ? "—" : undefined}
        {...(props.min === undefined ? {} : { min: props.min })}
        {...(props.max === undefined ? {} : { max: props.max })}
        step={props.step ?? 1}
        className="min-w-0 flex-1 bg-transparent text-[length:var(--type-caption)] outline-none [appearance:textfield]"
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
          event.preventDefault()
          const by = (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 10 : 1) * (props.step ?? 1)
          const next = steppedFrom(event.currentTarget.value, shown, read) + by
          event.currentTarget.value = String(Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, next)))
        }}
        onBlur={(event) => {
          const text = event.currentTarget.value
          const next = read(text)
          if (!untouched(text, shown) && next !== null) props.onCommit(next)
          else event.currentTarget.value = props.mixed === true ? "" : shown.text
        }}
      />
      {props.suffix === undefined ? null : (
        <span className="text-[length:var(--type-caption)] text-quiet">{props.suffix}</span>
      )}
    </form>
  )
}
