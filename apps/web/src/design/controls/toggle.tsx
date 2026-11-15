import { Button } from "@/components/ui/button"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

export function ToggleControl({ row, onChange }: ControlProps) {
  const on = !row.mixed && row.value === true
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={row.mixed ? "mixed" : on}
      data-control="toggle"
      onClick={() => onChange(row.mixed ? true : !on)}
      className={cn(
        "h-8 w-full rounded-lg px-2 font-normal shadow-[0px_0px_0px_1px_var(--field-edge)] active:translate-y-0",
        on
          ? "bg-pressed text-pressed-foreground shadow-[0px_0px_0px_1px_var(--pressed-edge)] hover:bg-pressed hover:text-pressed-foreground"
          : row.mixed
            ? "bg-canvas text-foreground"
            : "bg-white text-quiet",
      )}
    >
      {row.label}
    </Button>
  )
}
