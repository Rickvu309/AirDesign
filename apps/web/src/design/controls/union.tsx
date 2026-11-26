import { controlLabel } from "@/design/controls/control-label"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { designCopy } from "@/copy/design-copy"
import { fillCopy } from "@/copy/fill-copy"
import { optionCopy } from "@/copy/option-copy"
import { firstColor, seedOf } from "@/design/control-seed"
import { partControl, type ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

const rowCases = 5

function heldOf(control: ControlProps["control"]): Readonly<Record<string, unknown>> | null {
  return typeof control.value === "object" && control.value !== null
    ? (control.value as Readonly<Record<string, unknown>>)
    : null
}

export function UnionControl({ control, palette, onChange, inner }: ControlProps) {
  const label = useId()
  const cases = control.desc.kind === "union" ? control.desc.cases : {}
  const held = heldOf(control)
  const chosen = held === null ? undefined : Object.keys(held).find((name) => Object.hasOwn(cases, name))
  const chosenDesc = chosen === undefined ? undefined : cases[chosen]

  function pick(name: string) {
    const value = unionValue(control, name)
    if (value !== undefined && name !== chosen) onChange(value)
  }

  const shapeFill = control.field === "paint" && control.trait === "fills" && control.label !== fillCopy.box
  const names = Object.keys(cases).filter((name) => !shapeFill || name !== "pattern")

  return (
    <div className="flex flex-col gap-2" data-control="union" data-inherited={control.inherited ? "" : undefined}>
      {control.look.name.show === "above" ? (
        <div className="flex min-h-6 items-center justify-between gap-2">
          <span id={label} className={controlLabel}>
            {control.label}
          </span>
          {control.reset === null ? null : (
            <Button type="button" variant="ghost" size="panel-caption" onClick={() => onChange(null)}>
              {control.reset}
            </Button>
          )}
        </div>
      ) : (
        <span id={label} className="sr-only">
          {control.label}
        </span>
      )}
      {names.length <= 1 ? null : control.look.form === "list" ? (
        <UnionList
          label={label}
          names={names}
          chosen={chosen}
          inherited={control.inherited}
          mixed={control.mixed}
          pick={pick}
        />
      ) : (
        <div
          role="group"
          data-segments
          aria-labelledby={label}
          className={cn(
            "rounded-[var(--shape-control)] bg-[var(--panel-track)] p-0",
            names.length > rowCases ? "grid grid-cols-3 gap-0.5" : "flex h-[var(--control-dense)] items-center",
          )}
        >
          {names.map((name) => {
            const pressed = name === chosen
            const Icon = control.look.options[name]
            const word = optionCopy[name] ?? name
            return (
              <Button
                key={name}
                type="button"
                variant="panel-segment"
                size={null}
                data-inherited={control.inherited ? "" : undefined}
                aria-pressed={pressed}
                title={Icon === undefined ? undefined : word}
                onClick={() => pick(name)}
                className="min-w-0 flex-1"
              >
                {Icon === undefined ? (
                  <span className="px-1">{word}</span>
                ) : (
                  <>
                    <Icon size={14} className="size-3.5" strokeWidth={1.5} aria-hidden />
                    <span className="sr-only">{word}</span>
                  </>
                )}
              </Button>
            )
          })}
        </div>
      )}
      {chosen === undefined || chosenDesc === undefined || chosenDesc.kind === "mark" || inner === undefined
        ? null
        : inner({
            control: partControl(control, chosen, chosenDesc, held?.[chosen]),
            palette,
            onChange: (next) => onChange({ [chosen]: next }),
            inner,
          })}
    </div>
  )
}

function UnionList({
  label,
  names,
  chosen,
  inherited,
  mixed,
  pick,
}: {
  readonly label: string
  readonly names: readonly string[]
  readonly chosen: string | undefined
  readonly inherited: boolean
  readonly mixed: boolean
  readonly pick: (name: string) => void
}) {
  const value = chosen ?? null
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string" && names.includes(next)) pick(next)
      }}
    >
      <SelectTrigger
        aria-labelledby={label}
        variant="panel"
        size="dense"
        data-inherited={inherited ? "" : undefined}
        className="w-full"
      >
        <SelectValue>
          {(selected: string | null) => {
            const shown = selected ?? value
            return shown === null ? (mixed ? designCopy.mixed : "") : (optionCopy[shown] ?? shown)
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {names.map((name) => (
          <SelectItem key={name} variant="panel" value={name}>
            {optionCopy[name] ?? name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function unionValue(control: ControlProps["control"], name: string): unknown {
  const desc = control.desc.kind === "union" ? control.desc.cases[name] : undefined
  if (desc === undefined) return undefined
  if (desc.kind === "mark") return { [name]: true }
  const color = firstColor(heldOf(control)) ?? { var: "accent1" }
  return { [name]: seedOf(desc, color) }
}
