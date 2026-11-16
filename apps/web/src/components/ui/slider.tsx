import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "@/lib/class-names"

function Slider({
  className,
  label,
  valueText,
  ...props
}: SliderPrimitive.Root.Props<number> & {
  label: string
  valueText: (value: number) => string
}) {
  return (
    <SliderPrimitive.Root data-slot="slider" thumbAlignment="edge" className="w-full" {...props}>
      <SliderPrimitive.Control
        className={cn(
          "relative flex h-[var(--space-24)] w-full touch-none items-center select-none data-disabled:opacity-50",
          className,
        )}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative h-1 w-full grow overflow-hidden rounded-full bg-line select-none"
        >
          <SliderPrimitive.Indicator data-slot="slider-range" className="h-full bg-primary select-none" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          getAriaLabel={() => label}
          getAriaValueText={(_, value) => valueText(value)}
          className="relative block size-3.5 shrink-0 rounded-full border border-primary bg-white shadow-sm transition-[box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 hover:ring-primary/20 has-[:focus-visible]:outline-[length:var(--focus-ring-width)] has-[:focus-visible]:outline-offset-[var(--focus-ring-offset)] has-[:focus-visible]:outline-[var(--focus-ring)] has-[:focus-visible]:outline-solid"
        />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
