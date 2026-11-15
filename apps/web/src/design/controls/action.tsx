import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  type LucideIcon,
} from "lucide-react"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import { optionWord } from "@/copy/option-copy"
import type { ControlProps } from "@/design/panel"

const icons: Readonly<Record<string, LucideIcon>> = {
  "align.left": AlignStartVertical,
  "align.center": AlignCenterVertical,
  "align.right": AlignEndVertical,
  "align.top": AlignStartHorizontal,
  "align.middle": AlignCenterHorizontal,
  "align.bottom": AlignEndHorizontal,
  "distribute.horizontal": AlignHorizontalDistributeCenter,
  "distribute.vertical": AlignVerticalDistributeCenter,
}

export function ActionControl({ row, onChange }: ControlProps) {
  const label = useId()
  const options = row.desc.kind === "choice" ? row.desc.options : []
  return (
    <div className="flex flex-col gap-1.5" data-control="action">
      <span id={label} className="text-[length:var(--type-caption)] text-quiet">
        {row.label}
      </span>
      <div role="group" aria-labelledby={label} className="flex gap-1">
        {options.map((option) => {
          const Icon = icons[`${row.field}.${option}`]
          const name = `${row.label} ${optionWord(row.field, option).toLowerCase()}`
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
              {Icon === undefined ? optionWord(row.field, option) : <Icon aria-hidden />}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
