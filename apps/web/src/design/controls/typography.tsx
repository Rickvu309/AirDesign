import { useEffect, useState } from "react"
import { fontsFor } from "@airdesign/render"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { designCopy } from "@/copy/design-copy"
import { textCopy } from "@/copy/text-copy"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

export function TypographyControl({ control, onChange }: ControlProps) {
  const loader = typeof document === "undefined" ? undefined : fontsFor(document)
  const names = [...new Set(control.choices?.flatMap((choice) => choice.font ?? []) ?? [])].sort()
  const key = JSON.stringify(names)
  const [loaded, setLoaded] = useState("")
  const ready = loader === undefined || names.every((name) => loader.ready(name))
  useEffect(() => {
    if (loader === undefined || ready) return
    let current = true
    void Promise.all(names.map((name) => loader.load(name))).then(() => {
      if (current) setLoaded(key)
    })
    return () => {
      current = false
    }
  }, [key, loader, ready])
  const chosen = control.choices?.find((choice) => choice.value === control.value)
  return (
    <div data-fonts-pending={!ready && loaded !== key ? "" : undefined}>
      <Select
        value={chosen?.value ?? null}
        onValueChange={(value) => {
          if (value !== null) onChange(value)
        }}
      >
        <SelectTrigger
          aria-label={textCopy.style}
          disabled={!control.choices?.length}
          className={cn(
            "w-full rounded-[var(--shape-control)] border-0 bg-white px-2 shadow-[inset_0px_0px_0px_1px_var(--field-edge)]",
            chosen === undefined
              ? "h-[var(--control-dense)] text-[length:var(--type-caption)] data-[size=default]:h-[var(--control-dense)]"
              : "h-8",
          )}
          style={chosen?.appearance}
        >
          <SelectValue>
            {() => chosen?.label ?? (control.mixed ? designCopy.mixed : (control.placeholder ?? textCopy.custom))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start" className="max-h-96 rounded-xl">
          <SelectGroup className="p-0">
            <SelectLabel className="border-b px-3 py-2.5 text-sm font-medium text-foreground">
              {textCopy.styles}
            </SelectLabel>
            <div className="p-1">
              {control.choices?.map((choice) => (
                <SelectItem
                  key={choice.value}
                  value={choice.value}
                  check="start"
                  className="py-1.5"
                  title={choice.label}
                >
                  <span className="min-w-0 truncate">
                    {choice.label}
                    {choice.detail === undefined ? null : (
                      <span className="text-muted-foreground!">{` · ${choice.detail}`}</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </div>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
