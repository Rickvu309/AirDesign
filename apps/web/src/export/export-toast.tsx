import { useEffect, type CSSProperties, type ReactElement } from "react"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { exportCopy } from "@/export/export-options"

const downloadedPlace = "!transform-none ![left:540.56px] ![top:12px]"
const failedPlace = "!transform-none ![left:488.11px] ![top:12px]"

function CheckMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.63 8.31 L6.44 11.13 L12.38 5.19"
        fill="none"
        stroke="var(--background)"
        strokeWidth="1.09"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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

export function DownloadedToast() {
  useEffect(() => {
    showToast(
      "export-downloaded",
      <div className="flex h-10 w-[276.89px] items-center gap-2.5 rounded-[var(--shape-card)] bg-foreground pr-4 pl-3.5 text-[length:var(--type-dense)] leading-[17px] text-white shadow-[0_8px_24px_rgb(0_0_0/20%)]">
        <CheckMark />
        <span className="whitespace-nowrap">{exportCopy.downloaded}</span>
      </div>,
      "276.89px",
    )
  }, [])
  return (
    <Toaster
      position="top-center"
      offset={12}
      visibleToasts={1}
      style={{ "--width": "276.89px" } as CSSProperties}
      className={downloadedPlace}
    />
  )
}

export function FailedToast() {
  useEffect(() => {
    showToast(
      "export-failed",
      <div className="flex h-10 w-[381.78px] items-center rounded-[var(--shape-card)] bg-foreground pr-1.5 pl-3.5 text-[length:var(--type-dense)] leading-[17px] text-white shadow-[0_8px_24px_rgb(0_0_0/20%)]">
        <ErrorMark />
        <span className="ml-2.5 whitespace-nowrap">{exportCopy.failed}</span>
        <button
          type="button"
          className="ml-auto flex h-7 shrink-0 items-center rounded-md px-2.5 font-medium whitespace-nowrap"
        >
          {exportCopy.tryAgain}
        </button>
      </div>,
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
