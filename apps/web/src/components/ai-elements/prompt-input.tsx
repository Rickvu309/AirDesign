import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/class-names"

export function PromptInput({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
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
  return <p className={cn("min-w-0 flex-1 text-[length:var(--type-dense)] text-faint", className)} {...props} />
}

export function PromptInputFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between", className)} {...props} />
}

export function PromptInputButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
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
