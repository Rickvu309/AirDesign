import type { Color } from "@airdesign/document"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import { optionCopy } from "@/copy/option-copy"
import { caseSeed, firstColor, seedOf } from "@/design/control-seed"
import { partRow, type ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

function heldOf(row: ControlProps["row"]): Readonly<Record<string, unknown>> | null {
  return !row.mixed && typeof row.value === "object" && row.value !== null
    ? (row.value as Readonly<Record<string, unknown>>)
    : null
}

export function UnionControl({ row, palette, onChange, inner }: ControlProps) {
  const label = useId()
  const cases = row.desc.kind === "union" ? row.desc.cases : {}
  const held = heldOf(row)
  const chosen = held === null ? undefined : Object.keys(held).find((name) => Object.hasOwn(cases, name))
  const chosenDesc = chosen === undefined ? undefined : cases[chosen]
  const accent = palette.find((swatch) => swatch.scheme === "accent1")
  const color: Color = firstColor(held) ?? { scheme: accent?.scheme ?? "accent1" }

  function pick(name: string) {
    const desc = cases[name]
    if (desc === undefined || name === chosen) return
    if (desc.kind === "mark") onChange({ [name]: true })
    else onChange({ [name]: caseSeed(`${row.trait}.${row.field}.${name}`, color) ?? seedOf(desc, color) })
  }

  return (
    <div className="flex flex-col gap-3" data-control="union">
      {row.caption ? (
        <div className="flex min-h-6 items-center justify-between gap-2">
          <span id={label} className="text-[length:var(--type-caption)] text-quiet">
            {row.label}
          </span>
          {row.reset === null ? null : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[length:var(--type-caption)] font-normal text-quiet hover:text-foreground active:translate-y-0"
              onClick={() => onChange(null)}
            >
              {row.reset}
            </Button>
          )}
        </div>
      ) : (
        <span id={label} className="sr-only">
          {row.label}
        </span>
      )}
      <div role="group" aria-labelledby={label} className="flex h-8 items-center rounded-lg bg-line p-0.5">
        {Object.keys(cases).map((name) => {
          const pressed = name === chosen
          return (
            <Button
              key={name}
              type="button"
              variant="ghost"
              aria-pressed={pressed}
              onClick={() => pick(name)}
              className={cn(
                "h-7 min-w-0 flex-1 rounded-[var(--shape-control)] px-1 text-xs font-normal active:translate-y-0",
                pressed
                  ? "bg-white font-medium text-foreground shadow-[0px_1px_2px_var(--black-10)] hover:bg-white"
                  : "text-quiet hover:bg-transparent hover:text-foreground",
              )}
            >
              {optionCopy[name] ?? name}
            </Button>
          )
        })}
      </div>
      {chosen === undefined || chosenDesc === undefined || chosenDesc.kind === "mark" || inner === undefined
        ? null
        : inner({
            row: partRow(row, chosen, chosenDesc, held?.[chosen]),
            palette,
            onChange: (next) => onChange({ [chosen]: next }),
            inner,
          })}
    </div>
  )
}
