import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog"
import { productCopy } from "@/copy/product-copy"
import { CloseGlyph } from "@/credits/dialog-glyphs"

export function ResultDialog({
  icon,
  title,
  body,
  secondary,
  primary,
}: {
  icon: ReactNode
  title: string
  body: string
  secondary?: string
  primary: string
}) {
  return (
    <Dialog open>
      <DialogPortal>
        <DialogOverlay className="bg-black/25" />
        <DialogPopup
          initialFocus={false}
          className="fixed top-1/2 left-1/2 z-50 flex h-[207.5px] w-[400px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-3xl bg-white p-6 shadow-[inset_0_0_0_1px_rgb(0_0_0/8%),0_24px_48px_rgb(0_0_0/16%)] outline-none"
        >
          <div className="flex h-10 items-start justify-between">
            {icon}
            <button
              type="button"
              aria-label={productCopy.close}
              className="flex size-7 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-canvas"
            >
              <CloseGlyph />
            </button>
          </div>
          <div className="h-[var(--space-48)]">
            <DialogTitle className="text-[length:var(--type-section)] leading-[22px] font-semibold text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-[length:var(--type-dense)] leading-[var(--leading-body)] text-muted-foreground">
              {body}
            </DialogDescription>
          </div>
          <div className="flex h-10 items-end justify-end gap-2">
            {secondary ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg px-4 text-[length:var(--type-body)] leading-[18px]"
              >
                {secondary}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="default"
              className="h-9 rounded-lg px-4 text-[length:var(--type-body)] leading-[18px]"
            >
              {primary}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}

const tileShadow =
  "shadow-[inset_0_0_0_1px_var(--primary-strong),0_1px_0_rgb(255_255_255/35%),0_2px_6px_rgb(0_0_0/14%)]"
const blueTile = `flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(180deg,var(--primary-top),var(--primary))] ${tileShadow}`

export function OkTile() {
  return (
    <span className={blueTile}>
      <svg width="11" height="8" viewBox="0 0 11 8" aria-hidden="true">
        <path
          d="M0 4.5 L3.6 8 L11 0"
          fill="none"
          stroke="var(--background)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

export function ErrorTile() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(180deg,var(--danger-light),var(--destructive))] shadow-[inset_0_0_0_1px_var(--danger-edge),0_1px_0_rgb(255_255_255/35%),0_2px_6px_rgb(0_0_0/14%)]">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <line x1="7" y1="1.2" x2="7" y2="8.2" stroke="var(--background)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="7" cy="11.4" r="1.3" fill="var(--background)" />
      </svg>
    </span>
  )
}

export function ExpiredTile() {
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-[inset_0_0_0_1px_var(--neutral-edge),0_1px_0_rgb(255_255_255/35%),0_2px_6px_rgb(0_0_0/14%)]"
      style={{ backgroundImage: "linear-gradient(180deg, var(--neutral-top), var(--neutral-bottom))" }}
    >
      <span className="relative size-[var(--space-16)] rounded-full shadow-[inset_0_0_0_2px_var(--background)]">
        <svg className="absolute top-[3px] left-[7px]" width="3" height="7" viewBox="0 0 3 6.5" aria-hidden="true">
          <path
            d="M0 0 L0 4.5 L3 6.5"
            fill="none"
            stroke="var(--background)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  )
}
