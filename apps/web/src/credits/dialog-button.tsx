import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function DialogButton({
  tone,
  children,
  className,
}: {
  tone: "quiet" | "brand"
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-[14px] leading-[18px] font-medium",
        tone === "brand"
          ? "bg-[linear-gradient(180deg,#93b8ef,#4d94fb)] text-white shadow-[inset_0_0_0_1px_#2d6fcd] hover:brightness-105"
          : "bg-white text-foreground shadow-[inset_0_0_0_1px_#d7d7d6] hover:bg-canvas",
        className,
      )}
    >
      {children}
    </button>
  )
}

export function CloseGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0 0 L10 10 M10 0 L0 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function ExternalArrow() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <path
        d="M0 8 L8 0 L2.5 0 M8 0 L8 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
