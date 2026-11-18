import { controlLabel } from "@/design/controls/control-label"
import { useId } from "react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { DistributeSpacing } from "@/design/preset-icons"
import { Button } from "@/components/ui/button"
import { optionWord } from "@/copy/option-copy"
import type { ControlProps } from "@/design/panel"

const clusterSize = 3

function cluster(options: readonly string[]): readonly (readonly string[])[] {
  return Array.from({ length: Math.ceil(options.length / clusterSize) }, (_, at) =>
    options.slice(at * clusterSize, (at + 1) * clusterSize),
  )
}

export function ActionControl({ control, onChange }: ControlProps) {
  const label = useId()
  const options = control.desc.kind === "choice" ? control.desc.options : []
  if (control.field === "distribute")
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              aria-label={control.label}
              title={control.label}
              className="h-[var(--control-dense)] w-6 shrink-0 p-0 text-[var(--panel-icon)]"
            />
          }
        >
          <DistributeSpacing size={16} className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto">
          {options.map((option) => (
            <DropdownMenuItem
              key={option}
              aria-label={`${control.label} ${optionWord(control.field, option).toLowerCase()}`}
              onClick={() => onChange(option)}
            >
              {control.label} {optionWord(control.field, option).toLowerCase()}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  return (
    <div className="flex flex-col gap-1" data-control="action">
      <span id={label} className={control.look.name.show === "hidden" ? "sr-only" : controlLabel}>
        {control.label}
      </span>
      <div role="group" aria-labelledby={label} className="flex gap-2">
        {cluster(options).map((members) => (
          <div
            key={members.join(" ")}
            className="flex min-w-0 gap-px overflow-hidden rounded-[var(--shape-control)]"
            style={{ flexGrow: members.length, flexBasis: 0 }}
          >
            {members.map((option) => {
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
                  className="h-[var(--control-dense)] min-w-0 flex-1 rounded-none border-0 bg-[var(--panel-track)] px-0 text-foreground hover:bg-line active:translate-y-0"
                >
                  {Icon === undefined ? (
                    optionWord(control.field, option)
                  ) : (
                    <Icon size={16} className="size-4" strokeWidth={3} aria-hidden />
                  )}
                </Button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
