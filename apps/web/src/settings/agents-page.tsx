import { accountRoutes, signOutRoutes } from "@airdesign/catalog"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { disconnectBodyOf, disconnectTitleOf, productCopy } from "@/copy/product-copy"
import { DangerDialog } from "@/decks/danger-dialog"
import { DeckGlyph } from "@/decks/deck-glyph"
import { DecksShell } from "@/decks/decks-shell"
import { deckTime } from "@/decks/deck-time"
import { ModuleRow } from "@/settings/module-row"
import { AgentTile } from "@/settings/settings-controls"
import { settingsCopy } from "@/settings/settings-sample"
import { signInAddress } from "@/thin-notice"

type ConnectedAgent = {
  id: string
  name: string | null
  agent: "claude" | "claude-code" | "codex" | "other"
  host: string
  connected: string
}

type Listing = {
  ok: true
  account: { email: string }
  mcp: string
  agents: ConnectedAgent[]
}

const settingsAction =
  "h-[var(--space-32)] border-0 bg-background px-3.5 text-[length:var(--type-dense)] leading-[17px] shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-background"

async function post(path: string, body: object) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const answer = await response.json()
  if (response.status === 401 && answer.refusal === "session") {
    window.location.assign(signInAddress(window.location))
  }
  return answer
}

async function signOut(): Promise<void> {
  const response = await fetch(signOutRoutes.session.path, { method: signOutRoutes.session.method })
  if (response.ok) window.location.assign(signInAddress(window.location))
}

function agentLabel(item: ConnectedAgent): string {
  if (item.agent === "claude") return settingsCopy.claude
  if (item.agent === "claude-code") return "Claude Code"
  if (item.agent === "codex") return settingsCopy.codex
  const trimmed = item.name?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : item.host
}

function agentMark(item: ConnectedAgent) {
  if (item.agent === "claude" || item.agent === "claude-code") return <AgentTile name="claude" />
  if (item.agent === "codex") return <AgentTile name="codex" />
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground shadow-[inset_0_0_0_1px_var(--line)]">
      <DeckGlyph name="plug" size={15} />
    </span>
  )
}

function connectedStatus(iso: string, currentTime: number): string {
  return `${settingsCopy.connected} ${deckTime(iso, currentTime).card.replace(/^Edited /, "")}`
}

export function AgentsPage({ now = Date.now, navigate }: { now?: () => number; navigate: (path: string) => void }) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [copied, setCopied] = useState(false)
  const [disconnecting, setDisconnecting] = useState<ConnectedAgent | null>(null)
  const [busy, setBusy] = useState(false)
  const [disconnectFailed, setDisconnectFailed] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function refresh() {
    try {
      const result = await post(accountRoutes.agents.path, {})
      if (result.ok) {
        setListing(result)
        setUnavailable(false)
      } else {
        setUnavailable(true)
      }
    } catch {
      setUnavailable(true)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(refresh)
    const focused = () => void refresh()
    window.addEventListener("focus", focused)
    return () => {
      window.removeEventListener("focus", focused)
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
    }
  }, [])

  async function copyAddress() {
    if (listing === null) return
    await navigator.clipboard.writeText(listing.mcp)
    setCopied(true)
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 2000)
  }

  async function confirmDisconnect(item: ConnectedAgent) {
    setBusy(true)
    setDisconnectFailed(false)
    try {
      const result = await post(accountRoutes.revokeAgent.path, { id: item.id }).catch(() => ({ ok: false }))
      if (result.ok) {
        setDisconnecting(null)
        await refresh()
      } else setDisconnectFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-dvh w-full bg-background text-foreground">
      <DecksShell
        active="settings"
        account={listing?.account ?? { email: "" }}
        onSignOut={() => void signOut()}
        onNavigate={navigate}
      >
        <div className="-mx-14 -mt-10 h-full overflow-y-auto pt-10 pb-12">
          <div data-settings-header className="border-b border-line pb-6">
            <div className="mx-auto w-[860px]">
              <h1 className="text-[26px] leading-[34px] font-semibold tracking-[-0.5px] text-foreground">
                {settingsCopy.title}
              </h1>
            </div>
          </div>
          <div data-settings-content className="mx-auto mt-7 flex w-[860px] flex-col gap-4">
            <Card title={settingsCopy.agents} description={settingsCopy.agentsBody}>
              {listing === null && unavailable ? (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-4 py-3 shadow-[inset_0_1px_0_0_var(--line)]"
                >
                  <span className="text-[length:var(--type-body)] leading-[18px] text-muted-foreground">
                    {productCopy.agentsFailed}
                  </span>
                  <Button type="button" variant="outline" className={settingsAction} onClick={() => void refresh()}>
                    {productCopy.payTryAgain}
                  </Button>
                </div>
              ) : listing === null ? undefined : listing.agents.length === 0 ? (
                <div className="py-3 text-[length:var(--type-body)] leading-[18px] text-muted-foreground shadow-[inset_0_1px_0_0_var(--line)]">
                  {settingsCopy.notConnected}
                </div>
              ) : (
                <div className="flex flex-col">
                  {listing.agents.map((item) => (
                    <ModuleRow
                      key={item.id}
                      title={agentLabel(item)}
                      status={connectedStatus(item.connected, now())}
                      mark={agentMark(item)}
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          className={settingsAction}
                          onClick={() => setDisconnecting(item)}
                        >
                          {productCopy.disconnect}
                        </Button>
                      }
                    />
                  ))}
                </div>
              )}
            </Card>
            <Card title={settingsCopy.mcp} description={settingsCopy.mcpBody}>
              <div className="flex h-10 w-full items-center rounded-lg bg-muted pr-1 pl-3">
                <span className="min-w-0 flex-1 truncate text-[length:var(--type-dense)] leading-[17px] text-foreground">
                  {listing?.mcp ?? ""}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={listing === null}
                  className={settingsAction}
                  onClick={() => void copyAddress()}
                >
                  {copied ? productCopy.done : settingsCopy.copy}
                </Button>
              </div>
            </Card>
          </div>
        </div>
        {disconnecting !== null && (
          <DangerDialog
            title={disconnectTitleOf(agentLabel(disconnecting))}
            body={disconnectBodyOf(agentLabel(disconnecting))}
            action={productCopy.disconnect}
            busy={busy}
            className="pb-6"
            onCancel={() => {
              if (busy) return
              setDisconnecting(null)
              setDisconnectFailed(false)
            }}
            onConfirm={() => void confirmDisconnect(disconnecting)}
          >
            {disconnectFailed ? (
              <p
                role="alert"
                className="mt-3 text-[length:var(--type-dense)] leading-[var(--leading-body)] text-destructive"
              >
                {productCopy.disconnectFailed}
              </p>
            ) : null}
          </DangerDialog>
        )}
      </DecksShell>
    </div>
  )
}
