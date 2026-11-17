import { Button } from "@/components/ui/button"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

export function ToggleControl({ control, onChange }: ControlProps) {
  const Icon = control.look.name.show === "icon" ? control.look.name.icon : control.look.options.true
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
        "h-[var(--control-dense)] w-full rounded-[var(--shape-control)] border-0 px-2 font-normal active:translate-y-0",
        on
          ? "bg-pressed text-pressed-foreground hover:bg-pressed hover:text-pressed-foreground"
          : control.mixed
            ? "bg-canvas text-foreground"
            : "bg-white text-foreground shadow-[0px_0px_0px_1px_var(--line)]",
      )}
    >
      {Icon === undefined ? (
        control.label
      ) : (
        <>
          <Icon size={14} className="size-3.5" strokeWidth={1.5} aria-hidden />
          <span className="sr-only">{control.label}</span>
        </>
      )}
    </Button>
  )
}
