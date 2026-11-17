import { useId } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { optionWord } from "@/copy/option-copy"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

function ChoiceList({
  control,
  onChange,
  label,
  options,
}: ControlProps & { label: string; options: readonly string[] }) {
  const value = !control.mixed && typeof control.value === "string" ? control.value : null
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
          control.inherited ? "text-quiet" : null,
        )}
      >
        <SelectValue>
          {(selected: string | null) => (selected === null ? "" : optionWord(control.field, selected))}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {optionWord(control.field, option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ChoiceControl(props: ControlProps) {
  const { control, onChange } = props
  const label = useId()
  const options = control.desc.kind === "choice" ? control.desc.options : []
  const look = control.look
  const layout = look.form
  return (
    <div className="flex flex-col gap-1.5" data-control="choice" data-inherited={control.inherited ? "" : undefined}>
      <span
        id={label}
        className={look.name.show === "hidden" ? "sr-only" : "text-[length:var(--type-caption)] text-quiet"}
      >
        {control.label}
      </span>
      {layout === "list" ? (
        <ChoiceList {...props} label={label} options={options} />
      ) : (
        <div role="group" aria-labelledby={label} className="flex h-8 items-center rounded-lg bg-line p-0.5">
          {options.map((option) => {
            const Icon = look.options[option]
            const word = optionWord(control.field, option)
            const chosen = !control.mixed && control.value === option
            return (
              <Button
                key={option}
                type="button"
                variant="ghost"
                aria-pressed={chosen}
                aria-label={word}
                title={Icon ? word : undefined}
                onClick={() => {
                  if (!chosen) onChange(option)
                }}
                className={cn(
                  "h-7 flex-1 rounded-[var(--shape-control)] text-xs font-normal active:translate-y-0",
                  chosen
                    ? cn(
                        "bg-white font-medium shadow-[0px_1px_2px_var(--black-10)] hover:bg-white",
                        control.inherited ? "text-quiet" : "text-foreground",
                      )
                    : "text-quiet hover:bg-transparent hover:text-foreground",
                )}
              >
                {Icon ? <Icon size={16} strokeWidth={1.5} aria-hidden /> : word}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
