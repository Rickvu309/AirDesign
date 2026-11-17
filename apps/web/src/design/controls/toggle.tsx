import { Button } from "@/components/ui/button"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

export function ToggleControl({ control, onChange }: ControlProps) {
  const Icon = control.look.name.show === "icon" ? control.look.name.icon : undefined
  const on = !control.mixed && control.value === true
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={control.mixed ? "mixed" : on}
      title={Icon === undefined ? undefined : control.label}
      data-control="toggle"
      onClick={() => onChange(control.mixed ? true : !on)}
      className={cn(
        "h-8 w-full rounded-lg px-2 font-normal shadow-[0px_0px_0px_1px_var(--field-edge)] active:translate-y-0",
        on
          ? "bg-pressed text-pressed-foreground shadow-[0px_0px_0px_1px_var(--pressed-edge)] hover:bg-pressed hover:text-pressed-foreground"
          : control.mixed
            ? "bg-canvas text-foreground"
            : "bg-white text-quiet",
      )}
    >
      {Icon === undefined ? (
        control.label
      ) : (
        <>
          <Icon size={16} strokeWidth={1.5} aria-hidden />
          <span className="sr-only">{control.label}</span>
        </>
      )}
    </Button>
  )
}
