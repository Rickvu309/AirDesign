import { useState, type ReactNode } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { DeckGlyph } from "@/decks/deck-glyph"
import { DeleteAccountDialog } from "@/decks/delete-account"
import { AgentPromo } from "@/decks/agent-promo"
import { account, starredFolders } from "@/decks/sample-decks"
import { deckRoutes, type DeckSection } from "@/decks/deck-routes"
import { settingsPaths } from "@/settings/settings-routes"
import { settingsCopy } from "@/copy/settings-copy"
import { cn } from "@/lib/class-names"

const sections: {
  id: DeckSection
  label: string
  href: string
  glyph: "clock" | "decks" | "trash" | "gear"
  size: number
}[] = [
  { id: "recents", label: "Recents", href: deckRoutes.recentsGrid, glyph: "clock", size: 16 },
  { id: "all-decks", label: "All decks", href: deckRoutes.allDecksGrid, glyph: "decks", size: 16 },
  { id: "trash", label: "Trash", href: deckRoutes.trash, glyph: "trash", size: 15 },
  { id: "settings", label: "Settings", href: deckRoutes.settings, glyph: "gear", size: 16 },
]

const settingsMenu = [
  { path: settingsPaths.usage, label: settingsCopy.usage },
  { path: settingsPaths.agents, label: settingsCopy.agents },
  { path: settingsPaths.account, label: settingsCopy.account },
]

const accountButton = "flex h-10 w-full items-center gap-2.5 rounded-lg pr-2 pl-2 text-left hover:bg-black/4"

function AccountFace({ account: realAccount }: { account?: { email: string } }) {
  const name =
    realAccount === undefined ? account.name : realAccount.email === "" ? settingsCopy.account : realAccount.email
  return (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-[length:var(--type-caption)] leading-none font-semibold text-white">
        {realAccount === undefined ? account.initials : name.charAt(0).toUpperCase()}
      </span>
      <span
        data-account-name
        title={name}
        className="min-w-0 flex-1 truncate text-[length:var(--type-body)] leading-[var(--leading-body)] font-medium text-foreground"
      >
        {name}
      </span>
      <span className="shrink-0 text-faint">
        <DeckGlyph name="chevron" size={14} />
      </span>
    </>
  )
}

export function DecksShell({
  active,
  children,
  firstVisit = false,
  account: realAccount,
  onSignOut,
  onNavigate,
  search,
}: {
  active: DeckSection
  children: ReactNode
  firstVisit?: boolean
  account?: { email: string }
  onSignOut?: () => void
  onNavigate?: (path: string) => void
  search?: { value: string; onChange: (value: string) => void }
}) {
  const [deletingAccount, setDeletingAccount] = useState(false)
  const primary = { ...sections[0], href: realAccount ? "/" : sections[0].href }
  const rest = realAccount
    ? [
        { ...sections[1], href: "/all" },
        { ...sections[2], href: "/trash" },
        { ...sections[3], href: settingsPaths.usage },
      ]
    : sections.slice(1)
  return (
    <div className="flex h-full w-full max-md:flex-col">
      <aside
        data-decks-sidebar
        className="flex h-full w-[248px] shrink-0 flex-col bg-canvas px-3 pt-3 pb-3 max-md:h-auto max-md:w-full"
      >
        {realAccount && onSignOut ? (
          <>
            {deletingAccount && (
              <DeleteAccountDialog email={realAccount.email} onCancel={() => setDeletingAccount(false)} />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger type="button" className={accountButton}>
                <AccountFace account={realAccount} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {settingsMenu.map((item) => (
                  <DropdownMenuItem
                    key={item.path}
                    onClick={() => {
                      if (onNavigate) onNavigate(item.path)
                      else window.location.assign(item.path)
                    }}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => setDeletingAccount(true)}>
                  {settingsCopy.deleteAccount}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSignOut}>{settingsCopy.signOut}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <button type="button" className={accountButton}>
            <AccountFace account={realAccount} />
          </button>
        )}
        <form
          role="search"
          action="/"
          method="get"
          className="relative mt-3 block"
          onSubmit={(event) => {
            if (search || !realAccount) event.preventDefault()
          }}
        >
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint">
            <DeckGlyph name="search" size={15} />
          </span>
          <Input
            type="search"
            name="q"
            placeholder="Search"
            aria-label="Search"
            {...(search
              ? {
                  value: search.value,
                  onChange: (event) => search.onChange(event.currentTarget.value),
                  onKeyDown: (event) => {
                    if (event.key !== "Escape" || search.value === "") return
                    event.preventDefault()
                    search.onChange("")
                  },
                }
              : {})}
            className="h-9 rounded-lg border-0 bg-background pl-[var(--space-32)] text-sm shadow-[0_0_0_1px_var(--line)] placeholder:text-faint md:text-sm"
          />
        </form>
        <nav className="mt-4" aria-label="Decks">
          <a
            href={primary.href}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-lg pr-2.5 pl-2.5 text-[length:var(--type-body)] leading-[var(--leading-body)]",
              active === primary.id ? "bg-line font-medium text-foreground" : "text-quiet hover:bg-black/4",
            )}
            aria-current={active === primary.id ? "page" : undefined}
          >
            <DeckGlyph name={primary.glyph} size={primary.size} />
            {primary.label}
          </a>
          <div className="mt-3 h-px bg-line" />
          <div className="mt-4 flex flex-col gap-0.5">
            {rest.map((section) => (
              <a
                key={section.id}
                href={section.href}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg pr-2.5 pl-2.5 text-[length:var(--type-body)] leading-[var(--leading-body)]",
                  active === section.id ? "bg-line font-medium text-foreground" : "text-quiet hover:bg-black/4",
                )}
                aria-current={active === section.id ? "page" : undefined}
              >
                <DeckGlyph name={section.glyph} size={section.size} />
                {section.label}
              </a>
            ))}
          </div>
        </nav>
        {!realAccount && (
          <div className="mt-6 flex flex-col gap-0.5">
            <div className="flex h-8 items-center gap-1.5 pr-2.5 pl-2.5 text-[length:var(--type-caption)] leading-[var(--leading-body)] font-medium text-muted-foreground">
              <span className="text-faint">
                <DeckGlyph name="chevron" size={12} />
              </span>
              Starred
            </div>
            {firstVisit ? (
              <p className="px-2.5 pt-1 text-[length:var(--type-dense)] leading-[1.45] text-muted-foreground">
                Star a deck to keep it here.
              </p>
            ) : (
              starredFolders.map((folder) => (
                <button
                  key={folder}
                  type="button"
                  className="flex h-8 items-center gap-2.5 rounded-lg pr-2.5 pl-2.5 text-left text-[length:var(--type-dense)] leading-[var(--leading-body)] text-quiet hover:bg-black/4"
                >
                  <span className="text-muted-foreground">
                    <DeckGlyph name="folder" size={15} />
                  </span>
                  <span className="truncate">{folder}</span>
                </button>
              ))
            )}
          </div>
        )}
        <div className="mt-auto">
          {firstVisit && !realAccount ? (
            <a
              href={deckRoutes.connectAgent}
              className="flex h-9 items-center justify-center gap-2 rounded-lg bg-background text-[length:var(--type-dense)] leading-none font-medium text-foreground shadow-[inset_0_0_0_1px_var(--field-edge),0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <DeckGlyph name="plug" size={14} />
              Connect an agent
            </a>
          ) : (
            <AgentPromo {...(realAccount ? { href: settingsPaths.agents } : {})} />
          )}
        </div>
      </aside>
      <main data-decks-main className="min-w-0 flex-1 px-14 pt-10 max-md:px-4">
        {children}
      </main>
    </div>
  )
}
