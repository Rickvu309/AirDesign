import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { SettingsFrame } from "@/settings/settings-frame"
import { settingsCopy, usageHistory } from "@/settings/settings-sample"

const settingsAction =
  "h-[var(--space-32)] border-0 bg-background px-3.5 text-[length:var(--type-dense)] leading-[17px] shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-background"

const settingsSwitch =
  "h-5! w-9! border-transparent p-0! shadow-none after:hidden data-checked:bg-primary! [&_[data-slot=switch-thumb]]:size-4! [&_[data-slot=switch-thumb]]:shadow-[0_1px_2px_rgba(0,0,0,0.2)] [&_[data-slot=switch-thumb]]:data-checked:translate-x-[18px]!"

export function UsageTab({ children }: { children?: ReactNode }) {
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
        detail={settingsCopy.balance}
        description={settingsCopy.facts}
        align="end"
        actions={
          <Button
            type="button"
            variant="default"
            className="h-[var(--space-32)] px-3.5 text-[length:var(--type-dense)] leading-[17px]"
            style={{ width: 99.26 }}
          >
            {settingsCopy.addCredits}
          </Button>
        }
      >
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
          {usageHistory.map((row) => (
            <div
              key={row.date}
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
