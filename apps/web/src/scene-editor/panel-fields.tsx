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
        className={cn(props.hideLabel === true ? "sr-only" : "shrink-0 text-[length:var(--type-caption)] text-quiet")}
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
        className="min-w-0 flex-1 bg-transparent text-[length:var(--type-caption)] outline-none [appearance:textfield]"
        onBlur={(event) => {
          const text = event.currentTarget.value.trim()
          if (text === "") return
          const next = Number(text)
          if (Number.isFinite(next) && String(Math.round(next * 100) / 100) !== shown) props.onCommit(next)
          else event.currentTarget.value = props.mixed === true ? "" : shown
        }}
      />
      {props.suffix === undefined ? null : (
        <span className="text-[length:var(--type-caption)] text-quiet">{props.suffix}</span>
      )}
    </form>
  )
}
