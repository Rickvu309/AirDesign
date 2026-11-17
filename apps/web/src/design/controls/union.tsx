import type { Color } from "@airdesign/document"
import { useId } from "react"
import { Button } from "@/components/ui/button"
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
  const accent = palette.theme.find((swatch) => swatch.scheme === "accent1")
  const color: Color = firstColor(held) ?? { scheme: accent?.scheme ?? "accent1" }

  function pick(name: string) {
    const desc = cases[name]
    if (desc === undefined || name === chosen) return
    if (desc.kind === "mark") onChange({ [name]: true })
    else
      onChange({
        [name]:
          caseSeed(`${control.trait}.${control.field}.${name}`, color) ??
          seedOf(desc, color, 0, 1, control.nodes?.[0]?.node),
      })
  }

  return (
    <div className="flex flex-col gap-3" data-control="union" data-inherited={control.inherited ? "" : undefined}>
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
        aria-labelledby={label}
        className={cn(
          "rounded-[var(--shape-control)] bg-line p-0.5",
          Object.keys(cases).length > rowCases
            ? "grid grid-cols-3 gap-0.5"
            : "flex h-[var(--control-dense)] items-center",
        )}
      >
        {Object.keys(cases).map((name) => {
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
                "h-5 min-w-0 flex-1 rounded-[4px] px-1 text-xs font-normal active:translate-y-0",
                pressed
                  ? cn(
                      "bg-white font-medium shadow-[0px_1px_2px_var(--black-10)] hover:bg-white",
                      control.inherited ? "text-quiet" : "text-foreground",
                    )
                  : "text-quiet hover:bg-transparent hover:text-foreground",
              )}
            >
              {Icon === undefined ? (
                word
              ) : (
                <>
                  <Icon size={14} strokeWidth={1.5} aria-hidden />
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
