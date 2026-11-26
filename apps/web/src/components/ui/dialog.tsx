import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "@/lib/class-names"
import { productCopy } from "@/copy/product-copy"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 transition-opacity duration-150 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0",
        className,
      )}
      {...props}
    />
  )
}

function DialogPopup({ className, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Popup
      data-slot="dialog-popup"
      className={cn(
        "transition-[opacity,scale] duration-200 ease-out data-starting-style:opacity-0 data-starting-style:scale-[0.96] data-ending-style:opacity-0 data-ending-style:duration-150",
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPopup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPopup>
    </DialogPortal>
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

function ConfirmationDialog({
  title,
  body,
  action,
  busy = false,
  ready = true,
  danger = false,
  className,
  children,
  onCancel,
  onConfirm,
}: {
  title: React.ReactNode
  body: React.ReactNode
  action: React.ReactNode
  busy?: boolean
  ready?: boolean
  danger?: boolean
  className?: string
  children?: React.ReactNode
  onCancel?: () => void
  onConfirm?: () => void
}) {
  const cancel = React.useRef<HTMLButtonElement>(null)
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
            "fixed top-1/2 left-1/2 z-50 w-100 max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background shadow-[var(--shadow-confirmation)] outline-none",
            !danger && "pb-6",
            className,
          )}
        >
          {danger && (
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
          )}
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
          <div className={cn("px-6", danger ? "pt-20" : "pt-6")}>
            <DialogTitle
              className={cn(
                "text-[length:var(--type-section)] leading-5.5 font-semibold text-foreground",
                !danger && "pr-9",
              )}
            >
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
                variant="outline-field"
                size="dialog"
                disabled={busy}
                onClick={onCancel}
              >
                {productCopy.cancel}
              </Button>
              <Button
                type="button"
                disabled={busy || !ready}
                onClick={onConfirm}
                variant={danger ? "destructive-solid" : "default"}
                size="dialog"
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

export {
  ConfirmationDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
  DialogPortal,
  DialogPopup,
  DialogTitle,
}
