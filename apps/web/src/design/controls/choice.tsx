import { controlLabel } from "@/design/controls/control-label"
import { designCopy } from "@/copy/design-copy"
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
          "h-[var(--control-dense)] w-full rounded-[var(--shape-control)] border-0 bg-white text-[length:var(--type-caption)] shadow-[inset_0px_0px_0px_1px_var(--field-edge)] data-[size=default]:h-[var(--control-dense)]",
          control.inherited ? "text-quiet" : null,
        )}
      >
        <SelectValue>
          {(selected: string | null) => {
            const shown = selected ?? value
            return shown === null
              ? control.mixed
                ? designCopy.mixed
                : ""
              : (control.choices?.find((choice) => choice.value === shown)?.label ?? optionWord(control.field, shown))
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {control.choices?.find((choice) => choice.value === option)?.label ?? optionWord(control.field, option)}
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
  const arrow = control.trait === "border" && /^(head|tail)\./.test(control.field)
  const look = control.look
  const layout = look.form
  return (
    <div className="flex flex-col gap-1" data-control="choice" data-inherited={control.inherited ? "" : undefined}>
      <span id={label} className={look.name.show === "hidden" ? "sr-only" : controlLabel}>
        {arrow ? (
          <>
            <span className="sr-only">{control.label}</span>
            <span aria-hidden>{optionWord("", control.field.split(".").at(-1) ?? "")}</span>
          </>
        ) : (
          control.label
        )}
      </span>
      {layout === "list" ? (
        <ChoiceList {...props} label={label} options={options} />
      ) : (
        <div
          role="group"
          data-segments
          aria-labelledby={label}
          className="flex h-[var(--control-dense)] items-center rounded-[var(--shape-control)] bg-[var(--panel-track)] p-0"
        >
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
                title={Icon && look.unnamed !== true ? word : undefined}
                onClick={() => {
                  if (!chosen) onChange(option)
                }}
                className={cn(
                  "h-[var(--control-dense)] min-w-0 flex-1 rounded-[var(--panel-segment-radius)] px-0 text-xs font-normal active:translate-y-0",
                  chosen
                    ? cn(
                        "bg-white font-medium shadow-[inset_0_0_0_1px_var(--panel-edge)] hover:bg-white",
                        control.inherited ? "text-quiet" : "text-foreground",
                      )
                    : "text-quiet hover:bg-transparent hover:text-foreground",
                )}
              >
                {Icon ? (
                  <Icon size={14} className="size-3.5" strokeWidth={1.5} aria-hidden />
                ) : (
                  <span className="truncate">{word}</span>
                )}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
