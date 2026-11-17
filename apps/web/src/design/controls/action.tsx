import { useId } from "react"
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
  return (
    <div className="flex flex-col gap-1.5" data-control="action">
      <span
        id={label}
        className={control.look.name.show === "hidden" ? "sr-only" : "text-[length:var(--type-caption)] text-quiet"}
      >
        {control.label}
      </span>
      <div role="group" aria-labelledby={label} className="flex gap-1.5">
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
                  className="h-[var(--control-dense)] min-w-0 flex-1 rounded-none border-0 bg-muted px-0 text-foreground hover:bg-line active:translate-y-0"
                >
                  {Icon === undefined ? (
                    optionWord(control.field, option)
                  ) : (
                    <Icon size={14} className="size-3.5" strokeWidth={1.5} aria-hidden />
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
