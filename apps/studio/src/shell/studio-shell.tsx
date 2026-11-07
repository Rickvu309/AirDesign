import { useEffect, useState, type ReactNode } from "react"
import {listDecks} from "../decks/catalog-client.ts"
import { AgentMark, BrandMark, Avatar, Dropdown, Icon, NavItem, SearchField, CommandMenu, Toaster, copy, type CommandMenuItem } from "@airdesign/ui"

export type StarredDeck = { id: string; title: string }

type StudioShellProps = {
  starredDecks?: readonly StarredDeck[]
  intentLabel: string
  showIntent: boolean
  onSignOut: () => void
  search: string
  onSearch: (value: string) => void
  accountName?: string
  onNavigate?: (href: string) => void
  onBrowse?: (browse: "recent" | "all") => void
  children: ReactNode
}

export function StudioShell({ intentLabel, showIntent, onSignOut, accountName = "My account", search, onSearch, starredDecks, onBrowse, onNavigate, children }: StudioShellProps) {
  const [catalogStars,setCatalogStars]=useState<StarredDeck[]>([])
  useEffect(()=>{if(starredDecks)return;let stopped=false;const refresh=()=>{void listDecks(false,"").then(entries=>{if(!stopped)setCatalogStars(entries.filter(entry=>entry.starred))}).catch(()=>{})};refresh();window.addEventListener("catalog-changed",refresh);return()=>{stopped=true;window.removeEventListener("catalog-changed",refresh)}},[starredDecks])
  const stars=starredDecks ?? catalogStars
  const editor=window.location.pathname.startsWith("/deck/")
  const path = window.location.pathname
  const [commandsOpen, setCommandsOpen] = useState(false)
  const items: CommandMenuItem[] = [
    { id: "home", label: copy("shell.home"), onSelect: () => window.location.assign("/") },
    { id: "usage", label: "Usage", onSelect: () => window.location.assign("/settings/usage") },
    { id: "agents", label: "Connected agents", onSelect: () => window.location.assign("/settings/agents") },
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
    <div className={editor ? "ad-shell ad-editor-shell" : "ad-shell"} id="shell">
      {!editor && <aside className="ad-sidebar" aria-label="Workspace sidebar">
        <div className="ad-account"><Dropdown label="Account menu" trigger={<><Avatar name={accountName}/><span>{accountName}</span><Icon name="chevron"/></>}><a href="/settings/account">Account settings</a><button type="button" onClick={onSignOut}>{copy("access.sign_out")}</button></Dropdown></div>
        <SearchField value={search} onChange={onSearch}/>
        <nav aria-label="Workspace">
          <NavItem label={copy("decks.recents")} icon="recent" href="/" selected={path === "/" && !window.location.search} onSelect={onBrowse ? () => onBrowse("recent") : undefined}/>
          <NavItem label={copy("decks.all")} icon="decks" href="/?browse=all" selected={window.location.search.includes("browse=all")} onSelect={onBrowse ? () => onBrowse("all") : undefined}/>
          <NavItem label={copy("decks.trash")} icon="trash" href="/trash" selected={path === "/trash"} onSelect={onNavigate ? () => onNavigate("/trash") : undefined}/>
          <NavItem label={copy("settings.title")} icon="settings" href="/settings/usage" selected={path.startsWith("/settings/")} onSelect={onNavigate ? () => onNavigate("/settings/usage") : undefined}/>
        </nav>
        <details className="ad-starred" open><summary>{copy("shell.starred")}</summary>{stars.length ? stars.map(deck => <a key={deck.id} href={`/deck/${deck.id}`}><Icon name="decks"/>{deck.title}</a>) : <p>{copy("shell.starred_empty")}</p>}</details>
        <details className="ad-agent-card" open><summary aria-label="Bring your own agent"><span className="ad-agent-logos" aria-hidden="true"><span className="ad-agent-logo-codex"><AgentMark kind="codex"/></span><span className="ad-agent-logo-claude"><AgentMark kind="claude"/></span><span className="ad-agent-logo-brand"><BrandMark/></span><span className="ad-agent-logo-custom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m12 2 9 5v10l-9 5-9-5V7zm0 10L3 7m9 5 9-5m-9 5v10"/></svg></span><span><Icon name="plus"/></span></span><span className="ad-agent-collapse">−</span></summary><div className="ad-agent-description"><strong>{copy("shell.bring_agent")}</strong><p>{copy("shell.agent_hint")}</p></div><a className="ad-button ad-button-secondary ad-button-dialog" href="/settings/agents"><Icon name="plug"/>{copy("home.connect_agent")}</a></details>
      </aside>}
      <main className="ad-main">
        {showIntent ? <p className="ad-intent" role="status">{copy("home.intent_kept")} {intentLabel}</p> : null}
        {children}
      </main>
      <CommandMenu open={commandsOpen} onOpenChange={setCommandsOpen} items={items} />
      <Toaster />
    </div>
  )
}
