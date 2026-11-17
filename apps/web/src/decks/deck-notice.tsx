import { toast } from "@/components/ui/toast"
import { StatusPill } from "@/components/ui/status-pill"
import { productCopy } from "@/copy/product-copy"
import { movedToastOptions } from "@/decks/screens/deck-moved-toast"
import { ActionPill } from "@/thin-notice"

export type ToastId = string | number

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
        width={movedToastOptions.style.width}
        onAct={retry}
        error
      />
    ),
    { ...movedToastOptions, ...(over === undefined ? {} : { id: over }) },
  )
  failures.set(key, shown)
}

export function showStatus(text: string, id?: ToastId, duration = Number.POSITIVE_INFINITY) {
  return toast.custom(
    () => <StatusPill className="h-auto min-h-10 px-3.5 py-2 [overflow-wrap:anywhere]">{text}</StatusPill>,
    { ...movedToastOptions, id, duration },
  )
}
