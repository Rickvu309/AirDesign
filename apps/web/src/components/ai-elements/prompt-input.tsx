import type { ComponentProps, HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/class-names"

export function PromptInput({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="prompt-input"
      className={cn(
        "flex rounded-[var(--shape-dialog)] bg-white shadow-[0px_0px_0px_1px_var(--field-edge),0px_2px_8px_var(--black-5)]",
        className,
      )}
      {...props}
    />
  )
}

export function PromptInputBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 flex-1 items-center gap-2.5", className)} {...props} />
}

export function PromptInputText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("min-w-0 flex-1 text-[length:var(--type-dense)] text-quiet", className)} {...props} />
}

export function PromptInputTextarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      rows={1}
      className={cn(
        "max-h-40 min-w-0 flex-1 resize-none bg-transparent field-sizing-content text-[length:var(--type-dense)] leading-[1.5] text-foreground outline-none placeholder:text-quiet disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  )
}

export function PromptInputFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between", className)} {...props} />
}

export function PromptInputButton({ className, ...props }: ComponentProps<"button">) {
  return <button type="button" className={cn("flex shrink-0 items-center justify-center", className)} {...props} />
}

export function PromptInputChip({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex h-6 shrink-0 items-center gap-1 rounded-[var(--shape-control)] bg-line pr-1 pl-2 text-xs text-quiet",
        className,
      )}
    >
      {children}
    </span>
  )
}
