import { toast as sonner, type ExternalToast } from "sonner"
import { XIcon } from "lucide-react"
import { productCopy } from "@/copy/product-copy"

const persistent = { duration: Infinity, closeButton: true, dismissible: true }

export const toast = {
  dismiss: sonner.dismiss,
  success(message: Parameters<typeof sonner.success>[0], options?: ExternalToast) {
    return sonner.success(message, { ...options, ...(options?.action || options?.cancel ? persistent : {}) })
  },
  custom: sonner.custom,
  error(message: Parameters<typeof sonner.error>[0], options?: ExternalToast) {
    return sonner.error(message, { ...options, ...persistent })
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
            onClick={() => sonner.dismiss(id)}
          >
            <XIcon size={14} aria-hidden="true" />
          </button>
        </div>
      ),
      { ...options, ...persistent, style: { ...options?.style, maxWidth: "calc(100vw - 32px)" } },
    )
  },
}
