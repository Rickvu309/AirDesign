import { useAccountProfile } from "@/account/account-profile"
import { useId, useState, type ReactNode } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SparkIcon } from "@/components/ui/editor-icons"
import { Input } from "@/components/ui/input"
import { DeckGlyph } from "@/decks/deck-glyph"
import { DeleteAccountDialog } from "@/decks/delete-account"
import { accountName } from "@/decks/account-name"
import { AgentButton, AgentPromo } from "@/decks/agent-promo"
import { deckPath } from "@/decks/deck-listing"
import { account, starredFolders } from "@/decks/sample-decks"
import { deckRoutes, type DeckSection } from "@/decks/deck-routes"
import { settingsPaths, type SettingsPath } from "@/account/settings-paths"
import { settingsCopy } from "@/copy/settings-copy"
import { productCopy } from "@/copy/product-copy"
import { cn } from "@/lib/class-names"
import { composing } from "@/lib/composing"

const sections: {
  id: DeckSection
  label: string
  href: string
  page: string
  glyph: "clock" | "decks" | "trash" | "gear" | "spark"
  size: number
}[] = [
  { id: "recents", label: "Recents", href: deckRoutes.recentsGrid, page: "/", glyph: "clock", size: 15 },
  { id: "all-decks", label: "All decks", href: deckRoutes.allDecksGrid, page: "/all", glyph: "decks", size: 15 },
  { id: "aira", label: productCopy.agentName, href: deckRoutes.aira, page: "/aira", glyph: "spark", size: 15 },
  { id: "trash", label: "Trash", href: deckRoutes.trash, page: "/trash", glyph: "trash", size: 14 },
  { id: "settings", label: "Settings", href: deckRoutes.settings, page: settingsPaths.usage, glyph: "gear", size: 15 },
]

type SectionGlyph = (typeof sections)[number]["glyph"]

function SectionIcon({ glyph, size }: { glyph: SectionGlyph; size: number }) {
  return glyph === "spark" ? <SparkIcon size={size} className="text-primary" /> : <DeckGlyph name={glyph} size={size} />
}

const settingsMenu = [
  { path: settingsPaths.usage, label: settingsCopy.usage },
  { path: settingsPaths.agents, label: settingsCopy.agents },
  { path: settingsPaths.account, label: settingsCopy.account },
]

const iconColumn = "flex size-5 shrink-0 items-center justify-center"

const starredRow =
  "flex h-7 items-center gap-2 rounded-md px-2 text-left text-[length:var(--type-dense)] leading-[var(--leading-body)] text-quiet hover:bg-black/4"

function StarredRow({ name }: { name: string }) {
  return (
    <>
      <span data-sidebar-icon className={cn(iconColumn, "text-muted-foreground")}>
        <DeckGlyph name="folder" size={14} />
      </span>
      <span data-sidebar-label className="truncate">
        {name}
      </span>
    </>
  )
}

const accountButton = "flex h-8 max-w-full items-center gap-2 rounded-md px-2 text-left hover:bg-black/4"

function AccountFace({ account: realAccount }: { account?: { email: string } }) {
  const profile = useAccountProfile()
  const name =
    realAccount === undefined
      ? account.name
      : realAccount.email === ""
        ? settingsCopy.account
        : profile?.name || accountName(realAccount.email)
  return (
    <>
      <span
        data-sidebar-icon
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-navy text-[length:var(--type-caption)] leading-none font-semibold text-white"
      >
        {realAccount === undefined ? account.initials : [...name][0]?.toUpperCase()}
      </span>
      <span
        data-account-name
        data-sidebar-label
        title={realAccount?.email || name}
        className="min-w-0 truncate text-[length:var(--type-dense)] leading-[var(--leading-body)] font-medium text-foreground"
      >
        {name}
      </span>
      <span className="shrink-0 text-faint">
        <DeckGlyph name="chevron" size={12} />
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
  starred,
  settingsTab,
}: {
  settingsTab?: SettingsPath
  active?: DeckSection
  children: ReactNode
  firstVisit?: boolean
  account?: { email: string }
  onSignOut?: () => void
  onNavigate?: (path: string) => void
  search?: { value: string; onChange: (value: string) => void }
  starred?: readonly { readonly deck: string; readonly name: string; readonly doom?: object }[]
}) {
  const profile = useAccountProfile()
  const [deletingAccount, setDeletingAccount] = useState(false)
  const starredLabel = useId()
  const empty = realAccount ? starred?.length === 0 : firstVisit
  const [primary, ...rest] = sections.map((section) => (realAccount ? { ...section, href: section.page } : section))
  return (
    <div className="flex h-full w-full max-md:flex-col">
      <aside
        data-decks-sidebar
        className="flex h-full w-[240px] shrink-0 flex-col bg-canvas px-3 pt-2.5 pb-3 max-md:h-auto max-md:w-full"
      >
        {realAccount && onSignOut ? (
          <>
            {deletingAccount && (
              <DeleteAccountDialog email={realAccount.email} onCancel={() => setDeletingAccount(false)} />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className={accountButton}
                aria-label={
                  realAccount.email === ""
                    ? undefined
                    : `${profile?.name || accountName(realAccount.email)}, ${realAccount.email}`
                }
              >
                <AccountFace account={realAccount} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {realAccount.email !== "" && (
                  <p
                    data-account-email
                    className="truncate px-2 py-1.5 text-[length:var(--type-caption)] leading-[var(--leading-body)] text-muted-foreground"
                  >
                    {realAccount.email}
                  </p>
                )}
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
          className="relative mt-2 block"
          onSubmit={(event) => {
            if (search || !realAccount) event.preventDefault()
          }}
        >
          <span
            data-sidebar-icon
            className={cn(iconColumn, "pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-faint")}
          >
            <DeckGlyph name="search" size={14} />
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
                    if (composing(event) || event.key !== "Escape" || search.value === "") return
                    event.preventDefault()
                    search.onChange("")
                  },
                }
              : {})}
            className="h-7 rounded-md bg-background pl-9 text-[length:var(--type-dense)] placeholder:text-quiet md:text-[length:var(--type-dense)]"
          />
        </form>
        <nav className="mt-3" aria-label="Decks">
          <a
            href={primary.href}
            className={cn(
              "flex h-7 items-center gap-2 rounded-md px-2 text-[length:var(--type-dense)] leading-[var(--leading-body)]",
              active === primary.id ? "bg-line font-medium text-foreground" : "text-quiet hover:bg-black/4",
            )}
            aria-current={active === primary.id ? "page" : undefined}
          >
            <span data-sidebar-icon className={iconColumn}>
              <SectionIcon glyph={primary.glyph} size={primary.size} />
            </span>
            <span data-sidebar-label>{primary.label}</span>
          </a>
          <div className="mt-3 h-px bg-line" />
          <div className="mt-3 flex flex-col gap-0.5">
            {rest.map((section) => (
              <a
                key={section.id}
                href={section.href}
                className={cn(
                  "flex h-7 items-center gap-2 rounded-md px-2 text-[length:var(--type-dense)] leading-[var(--leading-body)]",
                  active === section.id ? "bg-line font-medium text-foreground" : "text-quiet hover:bg-black/4",
                )}
                aria-current={active === section.id ? "page" : undefined}
              >
                <span data-sidebar-icon className={iconColumn}>
                  <SectionIcon glyph={section.glyph} size={section.size} />
                </span>
                <span data-sidebar-label>{section.label}</span>
              </a>
            ))}
          </div>
        </nav>
        {(!realAccount || starred) && (
          <nav aria-labelledby={starredLabel} className="mt-5 flex flex-col gap-0.5">
            <div
              id={starredLabel}
              className="flex h-7 items-center gap-1 px-2 text-[length:var(--type-caption)] leading-[var(--leading-body)] font-medium text-muted-foreground"
            >
              {productCopy.starred}
              <span className="text-faint">
                <DeckGlyph name="chevron" size={12} />
              </span>
            </div>
            {empty ? (
              <p className="px-2 pt-1 text-[length:var(--type-dense)] leading-[1.45] text-muted-foreground">
                {productCopy.starredEmpty}
              </p>
            ) : starred && realAccount ? (
              starred.map((deck) => (
                <a key={deck.deck} href={deckPath(deck)} className={starredRow}>
                  <StarredRow name={deck.name} />
                </a>
              ))
            ) : (
              starredFolders.map((folder) => (
                <button key={folder} type="button" className={starredRow}>
                  <StarredRow name={folder} />
                </button>
              ))
            )}
          </nav>
        )}
        <div className="mt-auto">
          {firstVisit && !realAccount ? (
            <AgentButton href={deckRoutes.connectAgent} />
          ) : (
            settingsTab !== "agents" && (
              <AgentPromo {...(realAccount ? { href: settingsPaths.agents, ornaments: false } : {})} />
            )
          )}
        </div>
      </aside>
      <main data-decks-main className="min-w-0 flex-1 px-20 pt-8 max-md:px-4 max-md:pt-6">
        {children}
      </main>
    </div>
  )
}
