import type { Color } from "@airdesign/document"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import { fillCopy } from "@/copy/fill-copy"
import { optionCopy } from "@/copy/option-copy"
import { caseSeed, firstColor, seedOf } from "@/design/control-seed"
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
    const value = unionValue(control, palette, name)
    if (value !== undefined && name !== chosen) onChange(value)
  }

  const shapeFill = control.field === "value" && control.trait === "fill" && control.label !== fillCopy.box
  const names = Object.keys(cases).filter((name) => !shapeFill || name !== "pattern")

  return (
    <div className="flex flex-col gap-2" data-control="union" data-inherited={control.inherited ? "" : undefined}>
      {control.look.name.show === "above" ? (
        <div className="flex min-h-6 items-center justify-between gap-2">
          <span id={label} className="text-[length:var(--type-caption)] text-quiet">
            {control.label}
          </span>
          {control.reset === null ? null : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[length:var(--type-caption)] font-normal text-quiet hover:text-foreground active:translate-y-0"
              onClick={() => onChange(null)}
            >
              {control.reset}
            </Button>
          )}
        </div>
      ) : (
        <span id={label} className="sr-only">
          {control.label}
        </span>
      )}
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
              variant="ghost"
              aria-pressed={pressed}
              title={Icon === undefined ? undefined : word}
              onClick={() => pick(name)}
              className={cn(
                "h-[var(--control-dense)] min-w-0 flex-1 rounded-[var(--panel-segment-radius)] px-1 text-xs font-normal active:translate-y-0",
                pressed
                  ? cn(
                      "bg-white font-medium shadow-[inset_0_0_0_1px_var(--panel-edge)] hover:bg-white",
                      control.inherited ? "text-quiet" : "text-foreground",
                    )
                  : "text-quiet hover:bg-transparent hover:text-foreground",
              )}
            >
              {Icon === undefined ? (
                word
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

function unionValue(control: ControlProps["control"], palette: ControlProps["palette"], name: string): unknown {
  const desc = control.desc.kind === "union" ? control.desc.cases[name] : undefined
  if (desc === undefined) return undefined
  if (desc.kind === "mark") return { [name]: true }
  const accent = palette.theme.find((swatch) => swatch.scheme === "accent1")
  const color: Color = firstColor(heldOf(control)) ?? { scheme: accent?.scheme ?? "accent1" }
  return {
    [name]:
      caseSeed(`${control.trait}.${control.field}.${name}`, color) ??
      seedOf(desc, color, 0, 1, control.nodes?.[0]?.node),
  }
}

export function FillDetails({ control, palette, onChange }: ControlProps) {
  const chosen = heldOf(control)
  return (
    <div className="flex items-center justify-between">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={chosen !== null && "pattern" in chosen}
        onClick={() => {
          if (chosen === null || !("pattern" in chosen)) onChange(unionValue(control, palette, "pattern"))
        }}
      >
        {optionCopy.pattern}
      </Button>
      {control.reset === null ? null : (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          {control.reset}
        </Button>
      )}
    </div>
  )
}
