import { useEffect, useRef, useState } from "react"
import { ApproveAgent } from "@/connect/approve-agent"
import { ClaudeConnected } from "@/connect/screens/claude-connected"
import { claudeCodeConnect, claudeConnect, codexConnect, otherConnect, refusedConnect } from "@/connect/connect-copy"
import { authorizationError, oauthErrorRedirect } from "@/connect/oauth-request"

type Agent = "claude" | "codex" | null
type Screen = "claude" | "claude-code" | "codex" | "other"

type Consent = {
  agent: Agent
  name: string
  title: string
  subtitle: string
  ability: string
  footer: string
  screenTitle: string
  clientId: string
  redirectUri: string
  codeChallenge: string
  state: string | null
  resource: string | undefined
  account: { initials: string; name: string; email: string }
}

type View =
  | { kind: "loading" }
  | { kind: "refused" }
  | { kind: "consent"; consent: Consent }
  | { kind: "connected"; consent: Consent }

type Reply = { response: Response; body: unknown }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function refusal(body: unknown): "session" | "client" | "redirect" | "resource" | "field" | "challenge" | null {
  if (!isRecord(body) || body.ok !== false) return null
  if (
    body.refusal === "session" ||
    body.refusal === "client" ||
    body.refusal === "redirect" ||
    body.refusal === "resource" ||
    body.refusal === "field" ||
    body.refusal === "challenge"
  )
    return body.refusal
  return null
}

async function post(path: string, body: unknown): Promise<Reply | null> {
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const payload: unknown = await response.json().catch(() => null)
    return { response, body: payload }
  } catch {
    return null
  }
}

function signInAddress(): string {
  const signIn = new URL(import.meta.env.VITE_SIGN_IN_URL || "/sign-in", window.location.origin)
  signIn.searchParams.set("next", window.location.pathname + window.location.search)
  return signIn.href
}

function presentation(screen: Screen, host: string) {
  if (screen === "claude")
    return {
      agent: "claude" as const,
      name: "Claude",
      ...claudeConnect,
      screenTitle: claudeConnect.approveTitle,
    }
  if (screen === "claude-code")
    return {
      agent: "claude" as const,
      name: "Claude Code",
      ...claudeCodeConnect,
      screenTitle: claudeConnect.approveTitle,
    }
  if (screen === "codex")
    return {
      agent: "codex" as const,
      name: "Codex",
      ...codexConnect,
      screenTitle: codexConnect.approveTitle,
    }
  const copy = otherConnect(host)
  return {
    agent: null,
    name: host,
    title: copy.title,
    subtitle: claudeConnect.subtitle,
    ability: copy.ability,
    footer: copy.footer,
    screenTitle: claudeConnect.approveTitle,
  }
}

function clientScreen(body: unknown): { screen: Screen; host: string } | null {
  if (!isRecord(body) || body.ok !== true || typeof body.redirect_host !== "string") return null
  if (body.screen !== "claude" && body.screen !== "claude-code" && body.screen !== "codex" && body.screen !== "other")
    return null
  return { screen: body.screen, host: body.redirect_host }
}

async function consentRequest(): Promise<
  { kind: "redirect"; address: string } | { kind: "refused" } | { kind: "consent"; consent: Consent }
> {
  const current = new URL(window.location.href)
  const query = current.searchParams
  const resource = query.has("resource") ? (query.get("resource") ?? "") : undefined
  const clientBody: Record<string, string> = {
    client_id: query.get("client_id") ?? "",
    redirect_uri: query.get("redirect_uri") ?? "",
  }
  if (resource !== undefined) clientBody.resource = resource
  const clientReply = await post("/oauth/client", clientBody)
  if (clientReply === null) return { kind: "refused" }
  const clientRefusal = refusal(clientReply.body)
  if (clientReply.response.status === 401) {
    if (clientRefusal === "session") return { kind: "redirect", address: signInAddress() }
    return { kind: "refused" }
  }
  if (clientReply.response.status === 400 && clientRefusal !== null) return { kind: "refused" }
  if (!clientReply.response.ok) return { kind: "refused" }
  const client = clientScreen(clientReply.body)
  if (client === null) return { kind: "refused" }

  const redirectUri = query.get("redirect_uri") ?? ""
  const requestError = authorizationError(query)
  if (requestError !== null) {
    try {
      return {
        kind: "redirect",
        address: oauthErrorRedirect(redirectUri, requestError, query.get("state")),
      }
    } catch {
      return { kind: "refused" }
    }
  }

  const listReply = await post("/decks/list", {})
  if (listReply === null) return { kind: "refused" }
  if (listReply.response.status === 401) return { kind: "redirect", address: signInAddress() }
  if (!listReply.response.ok || !isRecord(listReply.body) || listReply.body.ok !== true) return { kind: "refused" }
  const account = listReply.body.account
  if (!isRecord(account) || typeof account.email !== "string" || account.email.length === 0) return { kind: "refused" }

  const content = presentation(client.screen, client.host)
  return {
    kind: "consent",
    consent: {
      ...content,
      clientId: query.get("client_id") ?? "",
      redirectUri,
      codeChallenge: query.get("code_challenge") ?? "",
      state: query.has("state") ? (query.get("state") ?? "") : null,
      resource,
      account: {
        initials: account.email.slice(0, 1).toUpperCase(),
        name: account.email,
        email: account.email,
      },
    },
  }
}

export function OAuthAuthorize() {
  const started = useRef(false)
  const approving = useRef(false)
  const [view, setView] = useState<View>({ kind: "loading" })
  const [isApproving, setIsApproving] = useState(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void consentRequest().then((answer) => {
      if (answer.kind === "redirect") {
        window.location.assign(answer.address)
        return
      }
      if (answer.kind === "refused") {
        setView({ kind: "refused" })
        return
      }
      setView(answer)
    })
  }, [])

  function deny(consent: Consent) {
    try {
      window.location.assign(oauthErrorRedirect(consent.redirectUri, "access_denied", consent.state))
    } catch {
      setView({ kind: "refused" })
    }
  }

  async function allow(consent: Consent) {
    if (approving.current) return
    approving.current = true
    setIsApproving(true)
    const body: Record<string, string> = {
      client_id: consent.clientId,
      redirect_uri: consent.redirectUri,
      code_challenge: consent.codeChallenge,
      code_challenge_method: "S256",
    }
    if (consent.state !== null) body.state = consent.state
    if (consent.resource !== undefined) body.resource = consent.resource

    const answer = await post("/oauth/approve", body)
    if (answer === null) {
      setView({ kind: "refused" })
      return
    }
    const approveRefusal = refusal(answer.body)
    if (answer.response.status === 400 && approveRefusal !== null) {
      setView({ kind: "refused" })
      return
    }
    if (
      !answer.response.ok ||
      !isRecord(answer.body) ||
      answer.body.ok !== true ||
      typeof answer.body.redirect !== "string"
    ) {
      setView({ kind: "refused" })
      return
    }

    const redirect = answer.body.redirect
    setView({ kind: "connected", consent })
    window.setTimeout(() => window.location.assign(redirect), 700)
  }

  if (view.kind === "loading") return null
  if (view.kind === "refused") {
    return (
      <main className="screen-frame grid place-items-center">
        <p className="text-[length:var(--type-dense)] text-foreground">{refusedConnect}</p>
      </main>
    )
  }
  if (view.kind === "connected") {
    return (
      <ClaudeConnected
        agent={view.consent.agent}
        name={view.consent.name}
        screenTitle={claudeConnect.connectedScreenTitle}
      />
    )
  }
  return (
    <ApproveAgent
      agent={view.consent.agent}
      title={view.consent.title}
      subtitle={view.consent.subtitle}
      ability={view.consent.ability}
      footer={view.consent.footer}
      screenTitle={view.consent.screenTitle}
      account={view.consent.account}
      onDeny={() => deny(view.consent)}
      onAllow={() => void allow(view.consent)}
      approving={isApproving}
    />
  )
}
