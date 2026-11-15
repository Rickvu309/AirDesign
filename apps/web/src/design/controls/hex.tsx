import { useEffect, useRef } from "react"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

const lightest = 0xe0
const hexDigits = /^#?([0-9A-Fa-f]{6})$/

function light(hex: string): boolean {
  return [0, 2, 4].every((at) => Number.parseInt(hex.slice(at, at + 2), 16) >= lightest)
}

export function HexControl({ row, onChange }: ControlProps) {
  const shown = typeof row.value === "string" && hexDigits.test(row.value) ? row.value.toUpperCase() : null
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = picker.current
    if (input === null) return
    const picked = () => {
      const hex = hexDigits.exec(input.value)?.[1]?.toUpperCase()
      if (hex !== undefined && hex !== shown) onChange(hex)
    }
    input.addEventListener("change", picked)
    return () => input.removeEventListener("change", picked)
  }, [shown, onChange])

  return (
    <label
      className="flex h-9 min-w-0 cursor-pointer items-center gap-2.5 rounded-lg bg-white px-3 shadow-[0px_0px_0px_1px_var(--field-edge)]"
      data-control="hex"
      data-focus-ring
      title={shown === null ? row.label : `${row.label} #${shown}`}
    >
      <span
        className={cn(
          "relative size-4 shrink-0 overflow-hidden rounded-sm",
          shown === null || light(shown) ? "shadow-[0px_0px_0px_1px_var(--field-edge)]" : null,
        )}
        style={{ background: shown === null ? undefined : `#${shown}` }}
      >
        <input
          ref={picker}
          type="color"
          aria-label={row.label}
          defaultValue={`#${shown ?? "000000"}`}
          key={shown ?? ""}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </span>
      <span className="truncate text-[length:var(--type-dense)] text-foreground">{row.label}</span>
    </label>
  )
}
