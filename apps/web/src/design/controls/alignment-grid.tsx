import { Button } from "@/components/ui/button"
import { optionWord } from "@/copy/option-copy"
import type { ControlProps } from "@/design/panel"
import type { KeyboardEvent } from "react"

function neighbor(index: number, key: string): number {
  switch (key) {
    case "ArrowLeft":
      return index % 3 > 0 ? index - 1 : index
    case "ArrowRight":
      return index % 3 < 2 ? index + 1 : index
    case "ArrowUp":
      return index >= 3 ? index - 3 : index
    case "ArrowDown":
      return index < 6 ? index + 3 : index
    default:
      return -1
  }
}

export function AlignmentGrid({
  control,
  onChange,
  label,
  options,
}: ControlProps & { label: string; options: readonly string[] }) {
  const selected = !control.mixed && typeof control.value === "string" ? options.indexOf(control.value) : -1

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = neighbor(index, event.key)
    if (next === -1) return
    event.preventDefault()
    const value = options[next]
    if (next === index || value === undefined) return
    const button = event.currentTarget.parentElement?.children.item(next)
    if (button instanceof HTMLButtonElement) button.focus()
    onChange(value)
  }

  return (
    <div
      role="group"
      aria-labelledby={label}
      className="grid h-[var(--panel-alignment-height)] grid-cols-3 grid-rows-3 rounded-[var(--shape-control)] bg-[var(--panel-track)]"
    >
      {options.map((option, index) => {
        const chosen = index === selected
        const word = optionWord("layout.align", option)
        return (
          <Button
            key={option}
            type="button"
            variant="ghost"
            aria-label={word}
            aria-pressed={chosen}
            title={word}
            tabIndex={index === Math.max(0, selected) ? 0 : -1}
            className="h-full min-w-0 rounded-[var(--shape-control)] px-0 text-[var(--panel-icon)] hover:bg-line aria-pressed:text-primary-strong active:translate-y-0"
            onClick={() => {
              if (!chosen) onChange(option)
            }}
            onKeyDown={(event) => move(event, index)}
          >
            <span aria-hidden className="size-0.5 rounded-full bg-current" />
          </Button>
        )
      })}
    </div>
  )
}
