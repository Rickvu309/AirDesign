import type { ReactNode } from "react"
import { productCopy } from "@/copy/product-copy"
import { creditsCopy } from "@/credits/credits-sample"
import { ModuleCard } from "@/settings/module-card"
import { SettingsButton, SettingsToggle } from "@/settings/settings-controls"
import { SettingsFrame } from "@/settings/settings-frame"
import { settingsCopy } from "@/settings/settings-sample"

export function UsageStage({
  balance,
  history,
  banner,
  children,
}: {
  balance: string
  history: readonly { date: string; what: string; amount: string }[]
  banner?: ReactNode
  children?: ReactNode
}) {
  return (
    <SettingsFrame tab="usage" overlay={children}>
      <ModuleCard
        title={settingsCopy.weeklyUsage}
        description={settingsCopy.resets}
        actions={<SettingsButton width={64.24}>{settingsCopy.reset}</SettingsButton>}
      >
        <div className="flex h-[17px] items-center gap-3">
          <div className="h-2 min-w-0 flex-1 rounded-[4px] bg-line">
            <div className="h-2 rounded-[4px] bg-primary" style={{ width: "51.212%" }} />
          </div>
          <span className="text-[13px] leading-[17px] text-muted-foreground">{settingsCopy.used}</span>
        </div>
      </ModuleCard>
      <ModuleCard
        title={settingsCopy.credits}
        detail={balance}
        description={settingsCopy.facts}
        align="end"
        actions={<SettingsButton tone="brand" width={99.26}>{settingsCopy.addCredits}</SettingsButton>}
      >
        {banner ? <div className="mb-3.5">{banner}</div> : null}
        <div className="flex items-center justify-between gap-4 pt-3.5 shadow-[inset_0_1px_0_0_var(--line)]">
          <div className="min-w-0">
            <div className="text-[14px] leading-[18px] font-medium text-foreground">{settingsCopy.autoReset}</div>
            <p className="mt-0.5 text-[13px] leading-[17px] text-muted-foreground">{settingsCopy.autoResetBody}</p>
          </div>
          <SettingsToggle label={settingsCopy.autoReset} />
        </div>
      </ModuleCard>
      <ModuleCard title={settingsCopy.history}>
        <div>
          {history.map((row) => (
            <div
              key={row.date + row.amount}
              className="flex items-center gap-4 py-2.5 text-[13px] leading-[17px] shadow-[inset_0_-1px_0_0_var(--line)]"
            >
              <span className="w-16 shrink-0 text-muted-foreground">{row.date}</span>
              <span className="min-w-0 flex-1 text-foreground">{row.what}</span>
              <span className="w-20 shrink-0 text-right font-medium text-foreground">{row.amount}</span>
            </div>
          ))}
        </div>
      </ModuleCard>
    </SettingsFrame>
  )
}

export function WaitingBanner() {
  return (
    <div className="flex h-[37px] items-center justify-between gap-3 rounded-lg bg-[#eef4fe] px-3">
      <span className="flex min-w-0 items-center gap-2.5">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <defs>
            <clipPath id="credits-wait-dash">
              <circle cx="8" cy="8" r="8" />
            </clipPath>
          </defs>
          <circle cx="8" cy="8" r="8" fill="none" stroke="#4d94fb" strokeWidth="4" strokeDasharray="14 30" strokeLinecap="butt" clipPath="url(#credits-wait-dash)" />
        </svg>
        <span className="truncate text-[13px] leading-[17px] font-medium text-[#2d6fcd]">{creditsCopy.waiting}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3.5">
        <button type="button" className="text-[13px] leading-[17px] font-medium text-[#2d6fcd] hover:underline">
          {productCopy.payOpen}
        </button>
        <button type="button" className="text-[13px] leading-[17px] font-medium text-muted-foreground hover:text-foreground">
          {productCopy.cancel}
        </button>
      </span>
    </div>
  )
}
