import { toast as sonner, type ExternalToast } from "sonner"
import { XIcon } from "lucide-react"
import { productCopy } from "@/copy/product-copy"

const persistent = { duration: Infinity, closeButton: true, dismissible: true }

let nextId = 0

function identified(options?: ExternalToast): ExternalToast {
  const revision = nextId++
  const id = options?.id ?? `airdesign-${revision}`
  return { ...options, id, testId: `airdesign-toast-${JSON.stringify(id)}/${revision}` }
}

function dismiss(id?: string | number) {
  if (typeof document !== "undefined") {
    for (const element of document.querySelectorAll<HTMLElement>("[data-sonner-toast]")) {
      if (id === undefined || element.dataset.testid?.startsWith(`airdesign-toast-${JSON.stringify(id)}/`)) {
        element.inert = true
        element.setAttribute("aria-hidden", "true")
      }
    }
  }
  return sonner.dismiss(id)
}

export const toast = {
  dismiss,
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
