import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { productCopy } from "@/copy/product-copy"
import { CloseGlyph, ExternalArrow } from "@/credits/dialog-glyphs"
import { cn } from "@/lib/class-names"

const presets = [
  { value: 10, label: productCopy.presetTen },
  { value: 25, label: productCopy.presetTwentyFive },
  { value: 50, label: productCopy.presetFifty },
] as const

export function AddCreditsDialog({
  open,
  balance,
  adding,
  next,
  amount,
  selected,
}: {
  open: boolean
  balance: string
  adding: string
  next: string
  amount: string
  selected: 10 | 25 | 50
}) {
  if (!open) return null
  return (
    <Dialog open>
      <DialogPortal>
        <DialogOverlay className="bg-black/25 duration-0 data-open:animate-none" style={{ backdropFilter: "none" }} />
        <BaseDialog.Popup
          initialFocus={false}
          className="fixed top-1/2 left-1/2 z-50 flex w-[440px] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-3xl bg-white p-6 shadow-[inset_0_0_0_1px_rgb(0_0_0/8%),0_24px_48px_rgb(0_0_0/16%)] outline-none data-open:animate-none"
        >
          <div className="flex h-7 items-center justify-between">
            <h2 className="text-[length:var(--type-section)] leading-[22px] font-semibold text-foreground">
              {productCopy.creditsAdd}
            </h2>
            <button
              type="button"
              aria-label={productCopy.close}
              className="flex size-7 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-canvas"
            >
              <CloseGlyph />
            </button>
          </div>
          <p className="text-[length:var(--type-dense)] leading-[var(--leading-body)] text-muted-foreground">
            {productCopy.creditsFacts}
          </p>
          <div>
            <div className="text-[length:var(--type-caption)] leading-4 font-medium text-muted-foreground">
              {productCopy.amount}
            </div>
            <div className="mt-2.5 flex h-11 items-center gap-2">
              <div className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-lg bg-white pr-3 pl-3 shadow-[inset_0_0_0_2px_var(--primary)]">
                <span className="text-[length:var(--type-section)] leading-[var(--leading-section)] text-[var(--muted-foreground)]">
                  $
                </span>
                <span className="text-[length:var(--type-section)] leading-[var(--leading-section)] font-semibold text-foreground">
                  {amount}
                </span>
                <span className="h-5 w-[1.5px] bg-[var(--primary)]" />
              </div>
              <div className="flex h-11 items-center gap-2" role="group" aria-label={productCopy.amount}>
                {presets.map((preset) => {
                  const on = selected === preset.value
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      aria-pressed={on}
                      className={cn(
                        "flex h-11 items-center rounded-lg px-3 text-[length:var(--type-dense)] leading-[17px] font-medium",
                        on
                          ? "bg-[var(--blue-tint)] text-tint-text shadow-[inset_0_0_0_1px_var(--primary)]"
                          : "bg-white text-foreground shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-canvas",
                      )}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <p className="mt-2.5 text-[length:var(--type-caption)] leading-4 text-muted-foreground">
              {productCopy.creditsMinimum}
            </p>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2.5 rounded-[var(--shape-card)] bg-canvas px-3.5 py-3.5 text-[length:var(--type-dense)] leading-[17px]">
            <dt className="text-muted-foreground">{productCopy.currentBalance}</dt>
            <dd className="text-right text-foreground">{balance}</dd>
            <dt className="text-muted-foreground">{productCopy.adding}</dt>
            <dd className="text-right text-foreground">{adding}</dd>
            <dt className="text-muted-foreground">{productCopy.newBalance}</dt>
            <dd className="text-right font-semibold text-foreground">{next}</dd>
          </dl>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg px-4 text-[length:var(--type-body)] leading-[18px]"
            >
              {productCopy.cancel}
            </Button>
            <Button
              type="button"
              variant="default"
              className="h-9 w-[186px] justify-between rounded-lg px-4 text-[length:var(--type-body)] leading-[18px]"
            >
              {productCopy.payContinue}
              <ExternalArrow />
            </Button>
          </div>
          <p className="text-right text-[length:var(--type-caption)] leading-4 text-quiet">{productCopy.payNewTab}</p>
        </BaseDialog.Popup>
      </DialogPortal>
    </Dialog>
  )
}
