import type { ReactNode } from "react"
import { ModuleCard } from "@/settings/module-card"
import { SettingsButton, SettingsToggle } from "@/settings/settings-controls"
import { SettingsFrame } from "@/settings/settings-frame"
import { settingsCopy, usageHistory } from "@/settings/settings-sample"

export function UsageTab({ children }: { children?: ReactNode }) {
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
        detail={settingsCopy.balance}
        description={settingsCopy.facts}
        align="end"
        actions={<SettingsButton tone="brand" width={99.26}>{settingsCopy.addCredits}</SettingsButton>}
      >
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
          {usageHistory.map((row) => (
            <div
              key={row.date}
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
