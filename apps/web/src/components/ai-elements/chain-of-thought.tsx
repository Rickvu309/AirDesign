import type { ComponentProps, ReactNode } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { EditorIcon } from "@/components/ui/editor-icons"
import { cn } from "@/lib/class-names"

export type StepStatus = "running" | "error" | "stopped"

const lineClass =
  "flex min-h-6 max-w-full min-w-0 items-center gap-1.5 text-[length:var(--type-dense)] text-muted-foreground"

const stepMark: Readonly<Record<"done" | StepStatus, "progress" | "check" | "x">> = {
  done: "check",
  error: "x",
  stopped: "x",
  running: "progress",
}

function StepMark({ status }: { status: StepStatus | undefined }) {
  const mark = stepMark[status ?? "done"]
  if (mark === "progress") {
    return (
      <span data-step-mark={mark} className="flex size-3 shrink-0 text-primary motion-safe:animate-spin">
        <svg viewBox="0 0 12 12" width={12} height={12} fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
          <path d="M10.5 6A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  return (
    <span data-step-mark={mark} className="flex size-3 shrink-0">
      <EditorIcon name={mark} size={12} />
    </span>
  )
}

function StepTitle({ children }: { children: ReactNode }) {
  return <span className="min-w-0 truncate">{children}</span>
}

export function ChainOfThoughtLine({
  status,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { status?: StepStatus | undefined }) {
  return (
    <div data-status={status} className={cn(lineClass, className)} {...props}>
      <StepMark status={status} />
      <StepTitle>{children}</StepTitle>
    </div>
  )
}

export function ChainOfThought({ className, ...props }: ComponentProps<typeof Collapsible>) {
  return <Collapsible className={cn("flex w-full min-w-0 flex-col", className)} {...props} />
}

export function ChainOfThoughtHeader({
  status,
  className,
  children,
  ...props
}: ComponentProps<typeof CollapsibleTrigger> & { status?: StepStatus | undefined }) {
  return (
    <CollapsibleTrigger
      className={cn(
        lineClass,
        "group/steps -mx-1 w-fit rounded-[var(--shape-control)] px-1 text-left outline-hidden [transition:color_var(--ease-micro)] hover:text-foreground",
        className,
      )}
      {...props}
    >
      <StepMark status={status} />
      <StepTitle>{children}</StepTitle>
      <svg
        viewBox="0 0 10 10"
        width={10}
        height={10}
        className="shrink-0 [transition:transform_var(--ease-micro)] group-data-[panel-open]/steps:rotate-90"
        aria-hidden="true"
      >
        <path d="M3.5 2.5 7 5l-3.5 2.5z" fill="currentColor" />
      </svg>
    </CollapsibleTrigger>
  )
}

export function ChainOfThoughtContent({ className, children, ...props }: ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      className="h-(--collapsible-panel-height) overflow-hidden [transition:height_var(--ease-micro)] data-[ending-style]:h-0 data-[starting-style]:h-0"
      {...props}
    >
      <ul className={cn("mt-1 ml-1 flex flex-col gap-0.5 border-l border-line pl-3", className)}>{children}</ul>
    </CollapsibleContent>
  )
}

export function ChainOfThoughtStep({
  status,
  className,
  children,
  ...props
}: ComponentProps<"li"> & { status?: StepStatus | undefined }) {
  return (
    <li data-status={status} className={cn(lineClass, className)} {...props}>
      <StepMark status={status} />
      <StepTitle>{children}</StepTitle>
    </li>
  )
}
