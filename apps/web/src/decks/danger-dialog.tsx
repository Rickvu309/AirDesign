import { useRef, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { productCopy } from "@/copy/product-copy"
import { cn } from "@/lib/class-names"

export function DangerDialog({
  title,
  body,
  action,
  busy = false,
  ready = true,
  className,
  children,
  onCancel,
  onConfirm,
}: {
  title: ReactNode
  body: ReactNode
  action: ReactNode
  busy?: boolean
  ready?: boolean
  className?: string
  children?: ReactNode
  onCancel?: () => void
  onConfirm?: () => void
}) {
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel?.()
      }}
    >
      <DialogPortal>
        <DialogOverlay className="bg-black/25" />
        <DialogPopup
          initialFocus={cancel}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background shadow-[inset_0_0_0_1px_rgb(0_0_0/8%),0_24px_48px_rgb(0_0_0/16%)] outline-none",
            className,
          )}
        >
          <div className="absolute top-6 left-6 flex size-10 items-center justify-center rounded-xl bg-[linear-gradient(180deg,var(--danger-light),var(--destructive))] shadow-[inset_0_0_0_1px_var(--danger-edge),0_1px_0_rgb(255_255_255/35%),0_2px_6px_rgb(0_0_0/14%)]">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <line
                x1="7"
                y1="1.2"
                x2="7"
                y2="8.2"
                stroke="var(--background)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <circle cx="7" cy="11.4" r="1.3" fill="var(--background)" />
            </svg>
          </div>
          <DialogClose className="absolute top-6 right-6 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-canvas">
            <svg width="10" height="10" viewBox="9 9 10 10" aria-hidden="true">
              <path
                d="M9 9 L19 19 M19 9 L9 19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="sr-only">{productCopy.close}</span>
          </DialogClose>
          <div className="px-6 pt-20">
            <DialogTitle className="text-[length:var(--type-section)] leading-[22px] font-semibold text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-[length:var(--type-dense)] leading-[var(--leading-body)] text-muted-foreground">
              {body}
            </DialogDescription>
            {children}
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                ref={cancel}
                type="button"
                variant="outline"
                disabled={busy}
                onClick={onCancel}
                className="h-9 border-0 bg-background px-4 text-sm font-medium text-foreground shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-background"
              >
                {productCopy.cancel}
              </Button>
              <Button
                type="button"
                disabled={busy || !ready}
                onClick={onConfirm}
                className="h-9 border-0 bg-danger-solid px-4 text-sm font-medium text-white shadow-[inset_0_0_0_1px_var(--danger-edge)] hover:bg-danger-solid"
              >
                {action}
              </Button>
            </div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
