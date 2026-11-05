import { useEffect, useState, type ReactNode } from "react"
import { CommandMenu, Toaster, Toolbar, copy, type CommandMenuItem } from "@airdesign/ui"

type StudioShellProps = {
  intentLabel: string
  showIntent: boolean
  onSignOut: () => void
  children: ReactNode
}

export function StudioShell({ intentLabel, showIntent, onSignOut, children }: StudioShellProps) {
  const [commandsOpen, setCommandsOpen] = useState(false)
  const items: CommandMenuItem[] = [
    { id: "home", label: copy("shell.home"), onSelect: () => window.location.assign("/") },
    { id: "sign-out", label: copy("access.sign_out"), onSelect: onSignOut },
  ]
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandsOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])
  return (
    <div className="ad-shell" id="shell">
      <header className="ad-topbar">
        <span className="ad-brand">{copy("shell.brand")}</span>
        <Toolbar label={copy("shell.home")} items={[{ id: "home", label: copy("shell.home"), onSelect: () => window.location.assign("/") }]} />
        <button type="button" className="ad-button ad-button-secondary ad-button-compact" onClick={() => setCommandsOpen(true)}>{copy("shell.command")}</button>
        <button type="button" className="ad-button ad-button-secondary ad-button-settings" onClick={onSignOut}>{copy("access.sign_out")}</button>
      </header>
      <main className="ad-main">
        {showIntent ? <p className="ad-intent" role="status">{copy("home.intent_kept")} {intentLabel}</p> : null}
        {children}
      </main>
      <CommandMenu open={commandsOpen} onOpenChange={setCommandsOpen} items={items} />
      <Toaster />
    </div>
  )
}
