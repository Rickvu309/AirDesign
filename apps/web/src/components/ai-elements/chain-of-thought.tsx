import type { ComponentProps, ReactNode } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

export type StepStatus = "running" | "error" | "stopped"

const lineClass =
  "flex min-h-6 max-w-full min-w-0 items-center gap-1.5 text-[length:var(--type-dense)] text-muted-foreground"

function StepTitle({ status, children }: { status?: StepStatus | undefined; children: ReactNode }) {
  return <span className={cn("min-w-0 truncate", status === "running" && "aira-shimmer")}>{children}</span>
}

export function ChainOfThoughtLine({
  status,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { status?: StepStatus | undefined }) {
  return (
    <div data-status={status} className={cn(lineClass, className)} {...props}>
      <StepTitle status={status}>{children}</StepTitle>
    </div>
  )
}

export function ChainOfThought({ className, ...props }: ComponentProps<typeof Collapsible>) {
  return <Collapsible className={cn("flex w-full min-w-0 flex-col", className)} {...props} />
}

export function ChainOfThoughtHeader({ className, children, ...props }: ComponentProps<typeof CollapsibleTrigger>) {
  return (
    <CollapsibleTrigger
      className={cn(
        lineClass,
        "group/steps -mx-1 w-fit rounded-[var(--shape-control)] px-1 text-left outline-hidden [transition:color_var(--ease-micro)] hover:text-foreground focus-visible:shadow-[0px_0px_0px_2px_var(--ring)] motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <StepTitle>{children}</StepTitle>
      <svg
        viewBox="0 0 10 10"
        width={10}
        height={10}
        className="shrink-0 [transition:transform_var(--ease-micro)] group-data-[panel-open]/steps:rotate-90 motion-reduce:transition-none"
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
      className="h-(--collapsible-panel-height) overflow-hidden [transition:height_var(--ease-micro)] data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none"
      {...props}
    >
      <ul className={cn("mt-1 ml-1 flex flex-col gap-0.5 border-l border-line pl-3", className)}>{children}</ul>
    </CollapsibleContent>
  )
}

const stepMark: Readonly<Record<"done" | StepStatus, "check" | "x" | null>> = {
  done: "check",
  error: "x",
  stopped: "x",
  running: null,
}

export function ChainOfThoughtStep({
  status,
  className,
  children,
  ...props
}: ComponentProps<"li"> & { status?: StepStatus | undefined }) {
  const mark = stepMark[status ?? "done"]
  return (
    <li data-status={status} className={cn(lineClass, className)} {...props}>
      {mark === null ? null : <EditorIcon name={mark} size={12} className="shrink-0" />}
      <StepTitle status={status}>{children}</StepTitle>
    </li>
  )
}
