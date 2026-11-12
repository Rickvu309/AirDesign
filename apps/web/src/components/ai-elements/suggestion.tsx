import type { ComponentProps } from "react"
import { cn } from "@/lib/class-names"

export function Suggestions({ className, ...props }: ComponentProps<"ul">) {
  return <ul className={cn("flex w-full flex-col gap-1.5", className)} {...props} />
}

export function Suggestion({
  suggestion,
  onPick,
  disabled,
  className,
}: {
  suggestion: string
  onPick: (suggestion: string) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <li className="flex">
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "flex min-h-9 w-full items-center rounded-[var(--shape-card)] bg-background px-3 py-2 text-left text-[length:var(--type-dense)] leading-[var(--leading-dense)] text-foreground shadow-[0px_0px_0px_1px_var(--line)] outline-hidden [transition:background-color_var(--ease-micro)] hover:bg-canvas focus-visible:shadow-[0px_0px_0px_2px_var(--ring)] disabled:cursor-not-allowed disabled:text-muted-foreground motion-reduce:transition-none",
          className,
        )}
        onClick={() => onPick(suggestion)}
      >
        {suggestion}
      </button>
    </li>
  )
}
