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
    <div className="screen-frame reflow-frame">
      <DecksShell active="settings">
        <div className="-mx-20 max-md:-mx-4">
          <div data-settings-header className="border-b border-line">
            <div className="mx-auto w-full max-w-[860px] max-md:px-4">
              <h1 className="text-[length:var(--type-title)] leading-8 font-medium tracking-[-0.4px] text-foreground">
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
                        "relative flex h-full items-start text-[length:var(--type-body)] leading-[1.43]",
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
          <div data-settings-content className="mx-auto mt-7 flex w-full max-w-[860px] flex-col gap-4 max-md:px-4">
            {children}
          </div>
        </div>
      </DecksShell>
      {overlay}
    </div>
  )
}
