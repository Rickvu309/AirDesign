import { controlLabel } from "@/design/controls/control-label"
import type { Preset } from "@airdesign/document"
import { ChevronDownIcon } from "lucide-react"
import { useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { optionWord } from "@/copy/option-copy"
import type { ControlProps } from "@/design/panel"
import { PresetThumb, ShapeGrid } from "@/design/shape-grid"
import { cn } from "@/lib/class-names"

export function PresetControl({ control, onChange }: ControlProps) {
  const label = useId()
  const shown = useId()
  const [open, setOpen] = useState(false)
  const chosenRef = useRef<HTMLButtonElement>(null)
  const shapes = (control.desc.kind === "choice" ? control.desc.options : []) as readonly Preset[]
  const chosen = !control.mixed && shapes.includes(control.value as Preset) ? (control.value as Preset) : null
  return (
    <div className="flex flex-col gap-1" data-control="preset" data-inherited={control.inherited ? "" : undefined}>
      <span id={label} className={control.look.name.show === "hidden" ? "sr-only" : controlLabel}>
        {control.label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              aria-labelledby={`${label} ${shown}`}
              className={cn(
                "h-[var(--control-dense)] w-full justify-start gap-2 rounded-[var(--shape-control)] bg-white px-2 text-[length:var(--type-caption)] font-normal shadow-[inset_0px_0px_0px_1px_var(--field-edge)] hover:bg-white active:translate-y-0",
                control.inherited ? "text-quiet" : "text-foreground",
              )}
            />
          }
        >
          {chosen === null ? null : <PresetThumb preset={chosen} size={18} />}
          <span id={shown} className="flex-1 truncate text-left">
            {chosen === null ? "" : optionWord(control.field, chosen)}
          </span>
          <ChevronDownIcon className="pointer-events-none size-3 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          initialFocus={chosenRef}
          className="w-auto bg-transparent p-0 shadow-none ring-0 duration-0"
        >
          <ShapeGrid
            label={control.label}
            shapes={shapes}
            chosen={chosen}
            chosenRef={chosenRef}
            onShape={(preset) => {
              setOpen(false)
              if (preset !== chosen) onChange(preset)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
