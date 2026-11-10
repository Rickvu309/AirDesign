import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { productCopy } from "@/copy/product-copy"
import { creditsCopy } from "@/credits/credits-sample"
import { SettingsFrame } from "@/settings/settings-frame"
import { settingsCopy } from "@/settings/settings-sample"

const settingsAction =
  "h-[var(--space-32)] border-0 bg-background px-3.5 text-[length:var(--type-dense)] leading-[17px] shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-background"

const settingsSwitch =
  "h-5! w-9! border-transparent p-0! shadow-none after:hidden focus-visible:ring-0 data-checked:bg-primary! [&_[data-slot=switch-thumb]]:size-4! [&_[data-slot=switch-thumb]]:shadow-[0_1px_2px_rgba(0,0,0,0.2)] [&_[data-slot=switch-thumb]]:data-checked:translate-x-[18px]!"

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
      <Card
        title={settingsCopy.weeklyUsage}
        description={settingsCopy.resets}
        actions={
          <Button type="button" variant="outline" className={settingsAction} style={{ width: 64.24 }}>
            {settingsCopy.reset}
          </Button>
        }
      >
        <div className="flex h-[var(--space-16)] items-center gap-3">
          <div className="h-2 min-w-0 flex-1 rounded-sm bg-line">
            <div className="h-2 rounded-sm bg-primary" style={{ width: "51.212%" }} />
          </div>
          <span className="text-[length:var(--type-dense)] leading-[17px] text-muted-foreground">
            {settingsCopy.used}
          </span>
        </div>
      </Card>
      <Card
        title={settingsCopy.credits}
        detail={balance}
        description={settingsCopy.facts}
        align="end"
        actions={
          <Button
            type="button"
            variant="default"
            className="h-[var(--space-32)] px-3.5 text-[length:var(--type-dense)] leading-[17px] shadow-[inset_0_0_0_1px_var(--primary-strong)]"
            style={{ width: 99.26 }}
          >
            {settingsCopy.addCredits}
          </Button>
        }
      >
        {banner ? <div className="mb-3.5">{banner}</div> : null}
        <div className="flex items-center justify-between gap-4 pt-3.5 shadow-[inset_0_1px_0_0_var(--line)]">
          <div className="min-w-0">
            <div className="text-[length:var(--type-body)] leading-[18px] font-medium text-foreground">
              {settingsCopy.autoReset}
            </div>
            <p className="mt-0.5 text-[length:var(--type-dense)] leading-[17px] text-muted-foreground">
              {settingsCopy.autoResetBody}
            </p>
          </div>
          <Switch defaultChecked aria-label={settingsCopy.autoReset} className={settingsSwitch} />
        </div>
      </Card>
      <Card title={settingsCopy.history}>
        <div>
          {history.map((row) => (
            <div
              key={row.date + row.amount}
              className="flex items-center gap-4 py-2.5 text-[length:var(--type-dense)] leading-[17px] shadow-[inset_0_-1px_0_0_var(--line)]"
            >
              <span className="w-16 shrink-0 text-muted-foreground">{row.date}</span>
              <span className="min-w-0 flex-1 text-foreground">{row.what}</span>
              <span className="w-20 shrink-0 text-right font-medium text-foreground">{row.amount}</span>
            </div>
          ))}
        </div>
      </Card>
    </SettingsFrame>
  )
}

export function WaitingBanner() {
  return (
    <div className="flex h-[37px] items-center justify-between gap-3 rounded-lg bg-[var(--blue-tint)] px-3">
      <span className="flex min-w-0 items-center gap-2.5">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <defs>
            <clipPath id="credits-wait-dash">
              <circle cx="8" cy="8" r="8" />
            </clipPath>
          </defs>
          <circle
            cx="8"
            cy="8"
            r="8"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="4"
            strokeDasharray="14 30"
            strokeLinecap="butt"
            clipPath="url(#credits-wait-dash)"
          />
        </svg>
        <span className="truncate text-[length:var(--type-dense)] leading-[17px] font-medium text-[var(--primary-strong)]">
          {creditsCopy.waiting}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3.5">
        <button
          type="button"
          className="text-[length:var(--type-dense)] leading-[17px] font-medium text-[var(--primary-strong)] hover:underline"
        >
          {productCopy.payOpen}
        </button>
        <button
          type="button"
          className="text-[length:var(--type-dense)] leading-[17px] font-medium text-muted-foreground hover:text-foreground"
        >
          {productCopy.cancel}
        </button>
      </span>
    </div>
  )
}
