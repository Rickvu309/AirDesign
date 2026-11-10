import type { HTMLAttributes } from "react"
import { cn } from "@/lib/class-names"

export function Conversation({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-h-0 flex-1 flex-col", className)} role="log" {...props} />
}

export function ConversationContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-6 px-4 pt-3", className)} {...props} />
}
