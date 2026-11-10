import type { ReactNode } from "react"
import { productCopy } from "@/copy/product-copy"
import { CloseGlyph, DialogButton } from "@/credits/dialog-button"
import { ScrimDialog } from "@/credits/scrim-dialog"

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
    <ScrimDialog className="flex h-[207.5px] w-[400px] flex-col gap-4 p-6">
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
      <div className="h-[47.5px]">
        <h2 className="text-[17px] leading-[22px] font-semibold text-foreground">{title}</h2>
        <p className="mt-1.5 text-[13px] leading-[19.5px] text-muted-foreground">{body}</p>
      </div>
      <div className="flex h-10 items-end justify-end gap-2">
        {secondary ? <DialogButton tone="quiet">{secondary}</DialogButton> : null}
        <DialogButton tone="brand">{primary}</DialogButton>
      </div>
    </ScrimDialog>
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

export function MoneyTile() {
  return (
    <span className={blueTile}>
      <span className="text-[18px] leading-none font-semibold text-white">$</span>
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
      <span className="relative size-[18px] rounded-full shadow-[inset_0_0_0_2px_var(--background)]">
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
