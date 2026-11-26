import type { CSSProperties } from "react"
import { toast } from "@/components/ui/toast"
import { StatusPill } from "@/components/ui/status-pill"
import { productCopy } from "@/copy/product-copy"
import { Toaster } from "@/components/ui/sonner"
import { ActionPill } from "@/components/ui/action-pill"

export type ToastId = string | number

export const pageToastWidth = "322.07px"
const pageToastMaxWidth = "min(26.25rem, calc(100vw - 32px))"

export const pageToastOptions = {
  unstyled: true,
  style: { left: 0, width: pageToastWidth },
}

const fitToastOptions = {
  unstyled: true,
  style: { left: 0, right: 0, pointerEvents: "none" as const },
}

export function PageToaster() {
  return (
    <Toaster
      position="top-center"
      offset={12}
      style={{ "--width": pageToastWidth } as CSSProperties}
      className="md:translate-x-[calc(var(--decks-sidebar-width)/2)]"
    />
  )
}

const failures = new Map<string, ToastId>()

export function settle(key: string) {
  const shown = failures.get(key)
  if (shown === undefined) return
  failures.delete(key)
  toast.dismiss(shown)
}

export function showFailed(key: string, text: string, retry: () => void, over?: ToastId) {
  settle(key)
  const shown = toast.notice(() => <ActionPill text={text} action={productCopy.payTryAgain} onAct={retry} error />, {
    ...fitToastOptions,
    tone: "light",
    maxWidth: pageToastMaxWidth,
    ...(over === undefined ? {} : { id: over }),
  })
  failures.set(key, shown)
}

export function showStatus(text: string, id?: ToastId, duration = Number.POSITIVE_INFINITY) {
  return toast.custom(
    () => (
      <div className="flex justify-center">
        <div className="pointer-events-auto w-max shrink-0" style={{ maxWidth: pageToastMaxWidth }}>
          <StatusPill layout="message">{text}</StatusPill>
        </div>
      </div>
    ),
    { ...fitToastOptions, id, duration },
  )
}
