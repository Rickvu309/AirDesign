import { useId } from "react"
import { Button } from "@/components/ui/button"
import { optionWord } from "@/copy/option-copy"
import type { ControlProps } from "@/design/panel"

export function ActionControl({ control, onChange }: ControlProps) {
  const label = useId()
  const options = control.desc.kind === "choice" ? control.desc.options : []
  return (
    <div className="flex flex-col gap-1.5" data-control="action">
      <span
        id={label}
        className={control.look.name.show === "hidden" ? "sr-only" : "text-[length:var(--type-caption)] text-quiet"}
      >
        {control.label}
      </span>
      <div role="group" aria-labelledby={label} className="flex gap-1">
        {options.map((option) => {
          const Icon = control.look.options[option]
          const name = `${control.label} ${optionWord(control.field, option).toLowerCase()}`
          return (
            <Button
              key={option}
              type="button"
              variant="ghost"
              aria-label={name}
              title={name}
              onClick={() => onChange(option)}
              className="h-8 min-w-0 flex-1 rounded-lg bg-white px-0 text-quiet shadow-[0px_0px_0px_1px_var(--field-edge)] hover:text-foreground active:translate-y-0"
            >
              {Icon === undefined ? (
                optionWord(control.field, option)
              ) : (
                <Icon size={16} strokeWidth={1.5} aria-hidden />
              )}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
