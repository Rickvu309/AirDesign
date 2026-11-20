import { toast as sonner, type ExternalToast, type ToastT } from "sonner"
import { XIcon } from "lucide-react"
import { productCopy } from "@/copy/product-copy"

const persistent = { duration: Infinity, closeButton: true, dismissible: true }

const figmaNotice = 3000

let nextId = 0

type ToastId = string | number

const showing = new Map<ToastId, ToastId>()
const named = new Map<ToastId, ToastId>()

function closing(name: ToastId, gone: ToastId) {
  if ((showing.get(name) ?? name) !== gone) return
  const fresh = `${String(name)}/${String(nextId++)}`
  showing.set(name, fresh)
  named.set(fresh, name)
}

function identified(options?: ExternalToast): ExternalToast {
  const revision = nextId++
  const name = options?.id
  const id = name === undefined ? `airdesign-${revision}` : (showing.get(name) ?? name)
  if (name !== undefined && !showing.has(name)) showing.set(name, id)
  const left = (shown: ToastT) => {
    if (name !== undefined) closing(name, shown.id)
  }
  return {
    ...options,
    id,
    testId: `airdesign-toast-${JSON.stringify(name ?? id)}/${revision}`,
    onDismiss(shown) {
      left(shown)
      options?.onDismiss?.(shown)
    },
    onAutoClose(shown) {
      left(shown)
      options?.onAutoClose?.(shown)
    },
  }
}

function dismiss(id?: ToastId) {
  const name = id === undefined ? undefined : (named.get(id) ?? id)
  if (typeof document !== "undefined") {
    for (const element of document.querySelectorAll<HTMLElement>("[data-sonner-toast]")) {
      if (name === undefined || element.dataset.testid?.startsWith(`airdesign-toast-${JSON.stringify(name)}/`)) {
        element.inert = true
        element.setAttribute("aria-hidden", "true")
      }
    }
  }
  if (name === undefined) {
    for (const [each, shown] of showing) closing(each, shown)
    return sonner.dismiss()
  }
  const shown = showing.get(name) ?? name
  closing(name, shown)
  return sonner.dismiss(shown)
}

export const toast = {
  dismiss,
  message(message: Parameters<typeof sonner.message>[0], options?: ExternalToast) {
    return sonner.message(message, identified(options))
  },
  success(message: Parameters<typeof sonner.success>[0], options?: ExternalToast) {
    return sonner.success(message, {
      ...identified(options),
      ...(options?.action || options?.cancel ? persistent : {}),
    })
  },
  custom(content: Parameters<typeof sonner.custom>[0], options?: ExternalToast) {
    return sonner.custom(content, identified(options))
  },
  error(message: Parameters<typeof sonner.error>[0], options?: ExternalToast) {
    return sonner.error(message, { ...identified(options), ...persistent })
  },
  refusal(message: Parameters<typeof sonner.error>[0], options?: ExternalToast) {
    return sonner.error(message, { ...identified(options), ...persistent, duration: figmaNotice })
  },
  notice(content: Parameters<typeof sonner.custom>[0], options?: ExternalToast) {
    return sonner.custom(
      (id) => (
        <div className="pointer-events-auto mx-auto flex w-max max-w-full items-center gap-1">
          <div className="min-w-0 [&>*]:max-w-full">{content(id)}</div>
          <button
            type="button"
            aria-label={productCopy.close}
            className="pointer-events-auto flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-white shadow-sm"
            onClick={() => dismiss(id)}
          >
            <XIcon size={14} aria-hidden="true" />
          </button>
        </div>
      ),
      { ...identified(options), ...persistent, style: { ...options?.style, maxWidth: "calc(100vw - 32px)" } },
    )
  },
}
