import { AlignmentGrid } from "@/design/controls/alignment-grid"
import { controlLabel } from "@/design/controls/control-label"
import { designCopy } from "@/copy/design-copy"
import { useId, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { optionWord, shownWord } from "@/copy/option-copy"
import type { ControlProps } from "@/design/panel"

function ChoiceList({
  control,
  onChange,
  label,
  options,
}: ControlProps & { label: string; options: readonly string[] }) {
  const value = !control.mixed && typeof control.value === "string" ? control.value : null
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <Select
      value={value}
      onValueChange={(next, details) => {
        const typedElsewhere =
          details.reason === "none" && trigger.current?.ownerDocument.activeElement !== trigger.current
        if (!typedElsewhere && typeof next === "string" && next !== value && options.includes(next)) onChange(next)
      }}
    >
      <SelectTrigger
        ref={trigger}
        aria-labelledby={label}
        variant="panel"
        size="dense"
        data-inherited={control.inherited ? "" : undefined}
        className="w-full"
      >
        <SelectValue>
          {(selected: string | null) => {
            const shown = selected ?? value
            return shown === null
              ? control.mixed
                ? designCopy.mixed
                : ""
              : (control.choices?.find((choice) => choice.value === shown)?.label ?? shownWord(control.field, shown))
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent data-keeps-format data-keeps-selection>
        {options.map((option) => (
          <SelectItem key={option} variant="panel" value={option}>
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
  const named = look.name.show !== "hidden"
  const reset = control.trait === "border" && named ? control.reset : null
  const title = arrow ? (
    <>
      <span className="sr-only">{control.label}</span>
      <span aria-hidden>{optionWord("", control.field.split(".").at(-1) ?? "")}</span>
    </>
  ) : (
    control.label
  )
  return (
    <div className="flex flex-col gap-1" data-control="choice" data-inherited={control.inherited ? "" : undefined}>
      {reset === null ? (
        <span id={label} className={named ? controlLabel : "sr-only"}>
          {title}
        </span>
      ) : (
        <div className="flex min-h-6 items-center justify-between gap-2">
          <span id={label} className={controlLabel}>
            {title}
          </span>
          <Button type="button" variant="ghost" size="panel-caption" onClick={() => onChange(null)}>
            {reset}
          </Button>
        </div>
      )}
      {layout === "list" ? (
        <ChoiceList {...props} label={label} options={options} />
      ) : layout === "grid" ? (
        <AlignmentGrid {...props} label={label} options={options} />
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
                variant="panel-segment"
                size={null}
                data-inherited={control.inherited ? "" : undefined}
                aria-pressed={chosen}
                aria-label={word}
                title={Icon ? word : undefined}
                onClick={() => {
                  if (!chosen) onChange(option)
                }}
                className="min-w-0 flex-1"
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
