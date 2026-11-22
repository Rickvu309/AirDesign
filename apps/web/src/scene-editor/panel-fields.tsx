import { type ReactNode, useId } from "react"
import { DesignSection } from "@/editor/design-panel"
import { cn } from "@/lib/class-names"

export function PanelSection(props: { readonly title: string; readonly name: string; readonly children: ReactNode }) {
  return (
    <div data-panel-section={props.name} className="contents">
      <DesignSection title={props.title}>{props.children}</DesignSection>
    </div>
  )
}

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
  const shown = props.value === undefined ? "" : String(Math.round(props.value * 100) / 100)
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
        className={cn(props.hideLabel === true ? "sr-only" : "shrink-0 text-[length:var(--type-dense)] text-quiet")}
      >
        {props.label}
      </label>
      <input
        key={`${shown}|${String(props.mixed)}`}
        id={id}
        type="number"
        inputMode="decimal"
        defaultValue={props.mixed === true ? "" : shown}
        placeholder={props.mixed === true ? "—" : undefined}
        {...(props.min === undefined ? {} : { min: props.min })}
        {...(props.max === undefined ? {} : { max: props.max })}
        step={props.step ?? 1}
        className="min-w-0 flex-1 bg-transparent text-[length:var(--type-dense)] outline-none [appearance:textfield]"
        onBlur={(event) => {
          const text = event.currentTarget.value.trim()
          if (text === "") return
          const next = Number(text)
          if (Number.isFinite(next) && String(Math.round(next * 100) / 100) !== shown) props.onCommit(next)
          else event.currentTarget.value = props.mixed === true ? "" : shown
        }}
      />
      {props.suffix === undefined ? null : (
        <span className="text-[length:var(--type-dense)] text-quiet">{props.suffix}</span>
      )}
    </form>
  )
}

export function Segmented<T extends string>(props: {
  readonly label: string
  readonly value: T | undefined
  readonly options: readonly { readonly value: T; readonly label: string; readonly icon?: ReactNode }[]
  readonly onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={props.label} className="flex rounded-md bg-muted p-0.5">
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={option.label}
          aria-pressed={option.value === props.value}
          title={option.label}
          onClick={() => props.onChange(option.value)}
          className={cn(
            "flex h-6 min-w-0 flex-1 items-center justify-center rounded px-1 text-[length:var(--type-dense)] whitespace-nowrap",
            option.value === props.value
              ? "bg-white shadow-[0_0_0_1px_var(--field-edge)]"
              : "text-quiet hover:text-foreground",
          )}
        >
          {option.icon ?? option.label}
        </button>
      ))}
    </div>
  )
}

export function FieldRow(props: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[length:var(--type-dense)] text-quiet">{props.label}</span>
      <div className="min-w-0 flex-1">{props.children}</div>
    </div>
  )
}
