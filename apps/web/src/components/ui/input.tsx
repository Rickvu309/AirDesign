import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/class-names"

function Input({
  className,
  type,
  variant = "default",
  ...props
}: React.ComponentProps<"input"> & { variant?: "default" | "embedded" }) {
  return (
    <InputPrimitive
      {...props}
      type={type}
      data-slot="input"
      className={cn(
        variant === "embedded"
          ? "min-w-0 bg-transparent outline-none placeholder:text-quiet"
          : "h-8 w-full min-w-0 rounded-lg bg-transparent px-2.5 py-1 text-base transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
        className,
      )}
    />
  )
}

export { Input }
