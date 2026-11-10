import type { ReactNode } from "react"
import { DecksShell } from "@/decks/decks-shell"
import { cn } from "@/lib/class-names"
import { settingsCopy } from "@/settings/settings-sample"
import { settingsRoutes, type SettingsTab } from "@/settings/settings-routes"

const tabs: { id: SettingsTab; label: string }[] = [
  { id: "usage", label: settingsCopy.usage },
  { id: "agents", label: settingsCopy.agents },
  { id: "account", label: settingsCopy.account },
]

export function SettingsFrame({
  tab,
  children,
  overlay,
}: {
  tab: SettingsTab
  children: ReactNode
  overlay?: ReactNode
}) {
  return (
    <div className="screen-frame">
      <DecksShell active="settings">
        <div className="-mx-14">
          <div className="border-b border-line">
            <div className="mx-auto w-[860px]">
              <h1 className="text-[26px] leading-[34px] font-semibold tracking-[-0.5px] text-foreground">
                {settingsCopy.title}
              </h1>
              <nav className="mt-6 flex h-[var(--space-32)] items-start gap-7" aria-label={settingsCopy.title}>
                {tabs.map((item) => {
                  const active = item.id === tab
                  return (
                    <a
                      key={item.id}
                      href={settingsRoutes[item.id]}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-full items-start text-[length:var(--type-body)] leading-[1.43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {item.label}
                      {active ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground" /> : null}
                    </a>
                  )
                })}
              </nav>
            </div>
          </div>
          <div className="mx-auto mt-7 flex w-[860px] flex-col gap-4">{children}</div>
        </div>
      </DecksShell>
      {overlay}
    </div>
  )
}
