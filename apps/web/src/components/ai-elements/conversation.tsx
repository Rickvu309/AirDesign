import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/class-names"

export function Conversation({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex min-h-0 flex-1 flex-col", className)} role="log" {...props} />
}

export function ConversationContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-6 px-4 pt-3", className)} {...props} />
}

export function ConversationEmptyState({
  icon,
  title,
  description,
  className,
  children,
}: {
  icon?: ReactNode
  title: string
  description?: string | undefined
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center", className)}>
      {icon}
      <div className="flex flex-col gap-1">
        <h2 className="text-[length:var(--type-section)] leading-[var(--leading-section)] font-medium text-foreground">
          {title}
        </h2>
        {description === undefined ? null : (
          <p className="text-[length:var(--type-dense)] leading-[var(--leading-dense)] text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

export function ConversationScrollButton({
  label,
  shown,
  onClick,
}: {
  label: string
  shown: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      data-shown={shown}
      className="absolute bottom-3 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full bg-background text-foreground opacity-0 shadow-[0px_0px_0px_1px_var(--field-edge),0px_2px_8px_var(--black-8)] [transition:opacity_var(--ease-micro),translate_var(--ease-micro)] pointer-events-none translate-y-1 outline-hidden data-[shown=true]:pointer-events-auto data-[shown=true]:translate-y-0 data-[shown=true]:opacity-100 motion-reduce:transition-none"
      onClick={onClick}
    >
      <svg
        viewBox="0 0 24 24"
        width={16}
        height={16}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        aria-hidden="true"
      >
        <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
