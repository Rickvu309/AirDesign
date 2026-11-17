import { signOutRoutes } from "@airdesign/catalog"
import type { ReactNode } from "react"
import { DecksShell } from "@/decks/decks-shell"
import { cn } from "@/lib/class-names"
import { settingsCopy } from "@/copy/settings-copy"
import { settingsPaths, type SettingsPath } from "@/settings/settings-routes"
import { signInAddress } from "@/thin-notice"

const tabs: { id: SettingsPath; label: string }[] = [
  { id: "usage", label: settingsCopy.usage },
  { id: "agents", label: settingsCopy.agents },
  { id: "account", label: settingsCopy.account },
]

export function SettingsPage({
  tab,
  email,
  navigate,
  onSignOut,
  children,
  overlay,
}: {
  tab: SettingsPath
  email: string
  navigate: (path: string) => void
  onSignOut: () => void
  children: ReactNode
  overlay?: ReactNode
}) {
  return (
    <div className="h-dvh w-full bg-background text-foreground">
      <DecksShell settingsTab={tab} active="settings" account={{ email }} onSignOut={onSignOut} onNavigate={navigate}>
        <div className="-mx-14 -mt-10 h-full overflow-y-auto pt-10 pb-12 max-md:-mx-4">
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
                      href={settingsPaths[item.id]}
                      aria-current={active ? "page" : undefined}
                      onClick={(event) => {
                        event.preventDefault()
                        navigate(settingsPaths[item.id])
                      }}
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
        {overlay}
      </DecksShell>
    </div>
  )
}

export async function signOut(): Promise<void> {
  const response = await fetch(signOutRoutes.session.path, { method: signOutRoutes.session.method })
  if (response.ok) window.location.assign(signInAddress(window.location))
}
