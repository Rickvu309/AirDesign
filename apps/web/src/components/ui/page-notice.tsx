import type { CSSProperties } from "react"
import { toast } from "@/components/ui/toast"
import { StatusPill } from "@/components/ui/status-pill"
import { productCopy } from "@/copy/product-copy"
import { Toaster } from "@/components/ui/sonner"
import { ActionPill } from "@/components/ui/action-pill"

export type ToastId = string | number

export const pageToastWidth = "322.07px"

export const pageToastOptions = {
  unstyled: true,
  style: { left: 0, width: pageToastWidth },
}

export function PageToaster() {
  return (
    <Toaster
      position="top-center"
      offset={12}
      style={{ "--width": pageToastWidth } as CSSProperties}
      className="min-[601px]:![left:calc(50%+124px)]"
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
  const shown = toast.notice(
    () => (
      <ActionPill
        text={text}
        action={productCopy.payTryAgain}
        width={pageToastOptions.style.width}
        onAct={retry}
        error
      />
    ),
    { ...pageToastOptions, ...(over === undefined ? {} : { id: over }) },
  )
  failures.set(key, shown)
}

export function showStatus(text: string, id?: ToastId, duration = Number.POSITIVE_INFINITY) {
  return toast.custom(
    () => <StatusPill className="h-auto min-h-10 px-3.5 py-2 [overflow-wrap:anywhere]">{text}</StatusPill>,
    { ...pageToastOptions, id, duration },
  )
}
