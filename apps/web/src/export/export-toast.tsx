import { useEffect, type CSSProperties, type ReactElement } from "react"
import { toast } from "@/components/ui/toast"
import { Toaster } from "@/components/ui/sonner"
import { StatusPill } from "@/components/ui/status-pill"
import { exportCopy } from "@/copy/export-copy"

const failedPlace = "!transform-none ![left:488.11px] ![top:12px]"

function ErrorMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="var(--destructive)" />
      <line x1="8" y1="4.5" x2="8" y2="8.7" stroke="var(--background)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="11.3" r="1" fill="var(--background)" />
    </svg>
  )
}

function showToast(id: string, node: ReactElement, width: string) {
  toast.custom(() => node, {
    id,
    duration: Infinity,
    unstyled: true,
    className: "!transition-none",
    style: {
      left: 0,
      width,
      opacity: 1,
      transform: "translateY(0)",
      transition: "none",
    },
  })
}

export function FailedToast() {
  useEffect(() => {
    showToast(
      "export-failed",
      <StatusPill className="w-[381.78px] pr-1.5 pl-3.5 leading-[17px]">
        <ErrorMark />
        <span className="ml-2.5 whitespace-nowrap">{exportCopy.failed}</span>
        <button
          type="button"
          className="ml-auto flex h-7 shrink-0 items-center rounded-md px-2.5 font-medium whitespace-nowrap"
        >
          {exportCopy.tryAgain}
        </button>
      </StatusPill>,
      "381.78px",
    )
  }, [])
  return (
    <Toaster
      position="top-center"
      offset={12}
      visibleToasts={1}
      style={{ "--width": "381.78px" } as CSSProperties}
      className={failedPlace}
    />
  )
}
