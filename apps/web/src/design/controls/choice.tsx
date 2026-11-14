import { useId } from "react"
import { Button } from "@/components/ui/button"
import { optionCopy } from "@/copy/option-copy"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

export function ChoiceControl({ row, onChange }: ControlProps) {
  const label = useId()
  const options = row.desc.kind === "choice" ? row.desc.options : []
  return (
    <div className="flex flex-col gap-1.5" data-control="choice">
      <span id={label} className="text-[length:var(--type-caption)] text-quiet">
        {row.label}
      </span>
      <div role="group" aria-labelledby={label} className="flex h-8 items-center rounded-lg bg-line p-0.5">
        {options.map((option) => {
          const chosen = !row.mixed && row.value === option
          return (
            <Button
              key={option}
              type="button"
              variant="ghost"
              aria-pressed={chosen}
              onClick={() => {
                if (!chosen) onChange(option)
              }}
              className={cn(
                "h-7 flex-1 rounded-[var(--shape-control)] text-xs font-normal active:translate-y-0",
                chosen
                  ? "bg-white font-medium text-foreground shadow-[0px_1px_2px_var(--black-10)] hover:bg-white"
                  : "text-quiet hover:bg-transparent hover:text-foreground",
              )}
            >
              {optionCopy[option] ?? option}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
