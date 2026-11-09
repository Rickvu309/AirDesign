import { productCopy } from "@/copy/product-copy"
import { CloseGlyph, DialogButton, ExternalArrow } from "@/credits/dialog-button"
import { ScrimDialog } from "@/credits/scrim-dialog"
import { cn } from "@/lib/utils"

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
    <ScrimDialog className="flex w-[440px] flex-col gap-5 p-6">
      <div className="flex h-7 items-center justify-between">
        <h2 className="text-[17px] leading-[22px] font-semibold text-foreground">{productCopy.creditsAdd}</h2>
        <button type="button" aria-label={productCopy.close} className="flex size-7 items-center justify-center rounded-md text-[#666666] hover:bg-canvas">
          <CloseGlyph />
        </button>
      </div>
      <p className="text-[13px] leading-[19.5px] text-muted-foreground">{productCopy.creditsFacts}</p>
      <div>
        <div className="text-[12px] leading-4 font-medium text-muted-foreground">{productCopy.amount}</div>
        <div className="mt-2.5 flex h-11 items-center gap-2">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-lg bg-white pr-3 pl-3 shadow-[inset_0_0_0_2px_#4d94fb]">
            <span className="text-[16px] leading-[21px] text-[#666666]">$</span>
            <span className="text-[16px] leading-[21px] font-semibold text-foreground">{amount}</span>
            <span className="h-5 w-[1.5px] bg-[#4d94fb]" />
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
                    "flex h-11 items-center rounded-lg px-3 text-[13px] leading-[17px] font-medium",
                    on
                      ? "bg-[#eef4fe] text-[#2d6fcd] shadow-[inset_0_0_0_1px_#4d94fb]"
                      : "bg-white text-foreground shadow-[inset_0_0_0_1px_#d7d7d6] hover:bg-canvas",
                  )}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </div>
        <p className="mt-2.5 text-[12px] leading-4 text-muted-foreground">{productCopy.creditsMinimum}</p>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2.5 rounded-[10px] bg-canvas px-3.5 py-3.5 text-[13px] leading-[17px]">
        <dt className="text-muted-foreground">{productCopy.currentBalance}</dt>
        <dd className="text-right text-foreground">{balance}</dd>
        <dt className="text-muted-foreground">{productCopy.adding}</dt>
        <dd className="text-right text-foreground">{adding}</dd>
        <dt className="text-muted-foreground">{productCopy.newBalance}</dt>
        <dd className="text-right font-semibold text-foreground">{next}</dd>
      </dl>
      <div className="flex items-center justify-end gap-2">
        <DialogButton tone="quiet">{productCopy.cancel}</DialogButton>
        <DialogButton tone="brand" className="w-[186px] justify-between">
          {productCopy.payContinue}
          <ExternalArrow />
        </DialogButton>
      </div>
      <p className="text-right text-[12px] leading-4 text-faint">{productCopy.payNewTab}</p>
    </ScrimDialog>
  )
}
