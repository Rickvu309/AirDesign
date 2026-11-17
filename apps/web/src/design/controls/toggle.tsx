import { FlipHorizontal2, FlipVertical2, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

const icons: Readonly<Record<string, LucideIcon>> = { flipH: FlipHorizontal2, flipV: FlipVertical2 }

export function ToggleControl({ row, onChange }: ControlProps) {
  const Icon = row.trait === "box" ? icons[row.field] : undefined
  const on = !row.mixed && row.value === true
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={row.mixed ? "mixed" : on}
      title={Icon === undefined ? undefined : row.label}
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
      {Icon === undefined ? (
        row.label
      ) : (
        <>
          <Icon size={16} aria-hidden />
          <span className="sr-only">{row.label}</span>
        </>
      )}
    </Button>
  )
}
