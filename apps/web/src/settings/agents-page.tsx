import { accountRoutes } from "@airdesign/catalog"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { disconnectBodyOf, disconnectTitleOf, productCopy } from "@/copy/product-copy"
import { DangerDialog } from "@/decks/danger-dialog"
import { DeckGlyph } from "@/decks/deck-glyph"
import { ModuleRow } from "@/settings/module-row"
import { SettingsPage } from "@/settings/settings-page"
import { signOut } from "@/account/sign-out"
import { AgentTile } from "@/settings/agent-tile"
import { settingsCopy } from "@/copy/settings-copy"
import { signInAddress } from "@/account/sign-in-address"
import { connectAgentCopy } from "@/copy/connect-agent-copy"
import { ConnectAgent } from "@/decks/connect-agent"
import { agentLabel, type AgentListing, type ConnectedAgent } from "@/decks/connected-agent"
import { AgentsEmpty } from "@/settings/agents-empty"

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

function tileOf(item: ConnectedAgent) {
  if (item.agent === "claude" || item.agent === "claude-code") return <AgentTile name="claude" />
  if (item.agent === "codex") return <AgentTile name="codex" />
  if (item.agent === "gemini") return <AgentTile name="gemini" />
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground shadow-[inset_0_0_0_1px_var(--line)]">
      <DeckGlyph name="plug" size={15} />
    </span>
  )
}

export function AgentsPage({ navigate }: { navigate: (path: string) => void }) {
  const [listing, setListing] = useState<AgentListing | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState<ConnectedAgent | null>(null)
  const [busy, setBusy] = useState(false)
  const [disconnectFailed, setDisconnectFailed] = useState(false)
  const asked = useRef(0)

  async function refresh() {
    const mine = ++asked.current
    try {
      const result = await post(accountRoutes.agents.path, {})
      if (mine !== asked.current) return
      if (result.ok) {
        setListing(result)
        setUnavailable(false)
      } else {
        setUnavailable(true)
      }
    } catch {
      if (mine === asked.current) setUnavailable(true)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(refresh)
    const focused = () => void refresh()
    window.addEventListener("focus", focused)
    return () => window.removeEventListener("focus", focused)
  }, [])

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

  const connect = (
    <Button type="button" variant="signature" className="gap-1.5 px-3.5" onClick={() => setConnecting(true)}>
      <DeckGlyph name="plug" size={14} />
      {connectAgentCopy.title}
    </Button>
  )

  return (
    <SettingsPage
      tab="agents"
      email={listing?.account.email ?? ""}
      navigate={navigate}
      onSignOut={() => void signOut()}
      overlay={
        <>
          {connecting && (
            <ConnectAgent
              onClose={() => {
                setConnecting(false)
                void refresh()
              }}
            />
          )}
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
                  className="mt-3 text-[length:var(--type-dense)] leading-[var(--leading-body)] text-danger-text"
                >
                  {productCopy.disconnectFailed}
                </p>
              ) : null}
            </DangerDialog>
          )}
        </>
      }
    >
      {listing?.agents.length === 0 ? (
        <AgentsEmpty onConnect={() => setConnecting(true)} />
      ) : (
        <Card title={settingsCopy.agents} description={settingsCopy.agentsBody} actions={connect}>
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
          ) : listing === null ? undefined : (
            <div className="flex flex-col">
              {listing.agents.map((item) => (
                <ModuleRow
                  key={item.id}
                  title={agentLabel(item)}
                  mark={tileOf(item)}
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
      )}
    </SettingsPage>
  )
}
