import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/class-names"

const inputSlots = {
  default: "input",
  embedded: "input-embedded",
  "editable-label": "editable-label",
} as const

const inputLooks = {
  default:
    "h-8 w-full min-w-0 rounded-lg bg-transparent px-2.5 py-1 text-base transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
  embedded: "min-w-0 bg-transparent outline-none placeholder:text-quiet",
  "editable-label":
    "h-8 w-full min-w-0 rounded-md border-0 bg-background px-1.5 font-medium text-foreground shadow-[0_0_0_1px_var(--field-edge)] outline-none",
} as const

function Input({
  className,
  type,
  variant = "default",
  ...props
}: React.ComponentProps<"input"> & { variant?: "default" | "embedded" | "editable-label" }) {
  return (
    <InputPrimitive
      {...props}
      type={type}
      data-slot={inputSlots[variant]}
      className={cn(inputLooks[variant], className)}
    />
  )
}

export { Input }
