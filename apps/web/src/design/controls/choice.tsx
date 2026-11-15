import { useId } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { optionWord } from "@/copy/option-copy"
import { choiceLayout } from "@/design/choice-layout"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

function ChoiceList({ row, onChange, label, options }: ControlProps & { label: string; options: readonly string[] }) {
  const value = !row.mixed && typeof row.value === "string" ? row.value : null
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string" && next !== value && options.includes(next)) onChange(next)
      }}
    >
      <SelectTrigger
        aria-labelledby={label}
        className={cn(
          "h-8 w-full rounded-lg border-0 bg-white text-[length:var(--type-dense)] shadow-[0px_0px_0px_1px_var(--field-edge)]",
          row.inherited ? "text-quiet" : null,
        )}
      >
        <SelectValue>
          {(selected: string | null) => (selected === null ? "" : optionWord(row.field, selected))}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {optionWord(row.field, option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ChoiceControl(props: ControlProps) {
  const { row, onChange } = props
  const label = useId()
  const options = row.desc.kind === "choice" ? row.desc.options : []
  const layout = choiceLayout(row.field, options, row.action === true)
  return (
    <div className="flex flex-col gap-1.5" data-control="choice" data-inherited={row.inherited ? "" : undefined}>
      <span id={label} className="text-[length:var(--type-caption)] text-quiet">
        {row.label}
      </span>
      {layout === "list" ? (
        <ChoiceList {...props} label={label} options={options} />
      ) : (
        <div
          role="group"
          aria-labelledby={label}
          className={cn(
            "items-center rounded-lg bg-line p-0.5",
            layout === "grid" ? "grid grid-cols-3 gap-y-0.5" : "flex h-8",
          )}
        >
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
                    ? cn(
                        "bg-white font-medium shadow-[0px_1px_2px_var(--black-10)] hover:bg-white",
                        row.inherited ? "text-quiet" : "text-foreground",
                      )
                    : "text-quiet hover:bg-transparent hover:text-foreground",
                )}
              >
                {optionWord(row.field, option)}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
