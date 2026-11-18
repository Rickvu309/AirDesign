import { useEffect, useState } from "react"
import { fontsFor } from "@airdesign/render"
import { designCopy } from "@/copy/design-copy"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { textCopy } from "@/copy/text-copy"
import type { ControlProps } from "@/design/panel"

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
          className="h-8 w-full rounded-[var(--shape-control)] border-0 bg-white px-2 shadow-[0px_0px_0px_1px_var(--field-edge)]"
          style={chosen?.appearance}
        >
          <SelectValue>
            {() => chosen?.label ?? (control.mixed ? designCopy.mixed : (control.placeholder ?? textCopy.custom))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="end" className="max-h-96 w-80 max-w-[calc(100vw-2rem)]">
          <SelectGroup>
            <SelectLabel>{textCopy.styles}</SelectLabel>
            {control.choices?.map((choice) => (
              <SelectItem key={choice.value} value={choice.value} style={choice.appearance} title={choice.label}>
                <span className="min-w-0 truncate">{choice.label}</span>
                {choice.detail === undefined ? null : <span className="shrink-0">{` · ${choice.detail}`}</span>}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
