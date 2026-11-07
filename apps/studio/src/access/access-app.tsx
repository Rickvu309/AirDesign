import { useEffect, useEffectEvent, useState } from "react"
import { flushSync } from "react-dom"
import { BrandMark, Icon, MailProviderMark, AlertDialog, Button, CodeEntry, TextField, copy, fillCopy, toast } from "@airdesign/ui"
import type { AccessClient, IntentKind } from "@airdesign/access/client"
import { readAccessLinkToken } from "@airdesign/access/client"
import {AgentsPanel,AgentApproval} from "../agents/agents-panel.tsx"
import {AccountPanel} from "../settings/account-panel.tsx"
import { UsagePanel } from "../usage/usage-panel.tsx"
import "../settings/settings.css"
import { Workspace } from "../decks/workspace.tsx"
import { StudioShell } from "../shell/studio-shell.tsx"

type Screen = "revalidating" | "checking" | "signin" | "check" | "expired" | "home"
type LinkStatus = "link-expired" | "link-used"

const intentCopy: Record<IntentKind, "shell.home" | "home.new_deck" | "home.import" | "home.connect_agent"> = {
  home: "shell.home",
  "new-deck": "home.new_deck",
  import: "home.import",
  "connect-agent": "home.connect_agent",
}

export type AccessRoute = { kind: "studio" } | { kind: "link"; token: string }

const studioRoute: AccessRoute = { kind: "studio" }
const studioHandoff = "studio"

type StudioHandoff = { airdesignAccess: typeof studioHandoff; consumedLinkToken: string }

export function readAccessRoute(location: { pathname: string; search: string }): AccessRoute {
  const token = readAccessLinkToken(location)
  if (!token) {
    return { kind: "studio" }
  }
  return { kind: "link", token }
}

function routeAfterHandoff(route: AccessRoute): AccessRoute {
  if (route.kind !== "link") {
    return route
  }
  const state = history.state as Partial<StudioHandoff> | null
  if (state?.airdesignAccess === studioHandoff && state.consumedLinkToken === route.token) {
    return studioRoute
  }
  return route
}

function replaceWithStudio(token: string): void {
  const state: StudioHandoff = { airdesignAccess: studioHandoff, consumedLinkToken: token }
  history.replaceState(state, "", "/")
}

export function AccessApp({ client, initialScreen = "signin", initialKind = "home", initialIntent = null, route: requestedRoute = studioRoute }: { client: AccessClient; initialScreen?: Screen; initialKind?: IntentKind; initialIntent?: string | null; route?: AccessRoute }) {
  const [route, setRoute] = useState<AccessRoute>(() => routeAfterHandoff(requestedRoute))
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [pathname, setPathname] = useState(window.location.pathname)
  const [homeSearch, setHomeSearch] = useState("")
  const [browse, setBrowse] = useState<"recent" | "all">(() => new URLSearchParams(window.location.search).get("browse") === "all" ? "all" : "recent")
  const [accountName, setAccountName] = useState("My account")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [emailError, setEmailError] = useState<string | undefined>()
  const [intentToken, setIntentToken] = useState<string | null>(initialIntent)
  const [kind, setKind] = useState<IntentKind>(initialKind)
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("link-expired")
  const [resendAvailableAt, setResendAvailableAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  const concealPrivateState = useEffectEvent(() => {
    if (screen !== "home" && screen !== "checking" && screen !== "revalidating") return false
    flushSync(() => {
      setScreen("revalidating")
      setConfirmSignOut(false)
    })
    return true
  })

  useEffect(() => {
    let generation = 0
    const conceal = () => {
      generation += 1
      return concealPrivateState()
    }
    const revalidate = async (concealFirst: boolean) => {
      if (concealFirst && !conceal()) return
      if (!concealFirst) generation += 1
      const current = generation
      try {
        const result = await client.session()
        if (current !== generation) return
        if (result.status === "signed-in") {
          if (!concealFirst) return
          setAccountName(result.displayName || result.email)
          setKind(result.kind ?? "home")
          setIntentToken(result.intentToken)
          setScreen("home")
          return
        }
      } catch {
        if (current !== generation || !concealFirst) return
      }
      if (!concealFirst && !concealPrivateState()) return
      history.replaceState(null, "", "/")
      setAccountName("My account")
      setHomeSearch("")
      setPathname("/")
      setEmail("")
      setCode("")
      setIntentToken(null)
      setKind("home")
      setRoute(studioRoute)
      setScreen("signin")
    }
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) void revalidate(true)
    }
    const visibility = () => {
      if (document.visibilityState === "visible") void revalidate(false)
    }
    window.addEventListener("pagehide", conceal)
    window.addEventListener("pageshow", restore)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      generation += 1
      window.removeEventListener("pagehide", conceal)
      window.removeEventListener("pageshow", restore)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [client])
  useEffect(() => {
    const syncBrowse = () => {
      setPathname(window.location.pathname)
      setBrowse(new URLSearchParams(window.location.search).get("browse") === "all" ? "all" : "recent")
    }
    window.addEventListener("popstate", syncBrowse)
    return () => window.removeEventListener("popstate", syncBrowse)
  }, [])

  const navigateWorkspace = (href: string) => {
    history.pushState(history.state, "", href)
    setPathname(window.location.pathname)
    setBrowse(new URLSearchParams(window.location.search).get("browse") === "all" ? "all" : "recent")
  }

  const browseWorkspace = (next: "recent" | "all") => {
    navigateWorkspace(next === "all" ? "/?browse=all" : "/")
  }

  const searchWorkspace = (query: string) => {
    setHomeSearch(query)
    if (window.location.pathname !== "/") navigateWorkspace("/?browse=all")
  }

  const enterWorkspace = (nextKind: IntentKind, nextIntent: string, handoffToken: string | null) => {
    setKind(nextKind)
    setIntentToken(nextIntent)
    if (handoffToken) {
      replaceWithStudio(handoffToken)
      setRoute(studioRoute)
    }
    setScreen("home")
  }

  useEffect(() => {
    if (route.kind === "link" || screen !== "signin" || intentToken) {
      return
    }
    let cancel = false
    void client.issueIntent(kind).then((issued) => {
      if (cancel || issued.status !== "issued") {
        return
      }
      setIntentToken(issued.token)
      setKind(issued.kind)
    })
    return () => {
      cancel = true
    }
  }, [client, intentToken, kind, route, screen])

  useEffect(() => {
    if (route.kind !== "link") {
      return
    }
    let cancel = false
    void (async () => {
      const result = await client.consumeLink(route.token)
      if (cancel) {
        return
      }
      if (result.status === "signed-in") {
        replaceWithStudio(route.token)
        setKind(result.kind)
        setIntentToken(result.intentToken)
        setRoute(studioRoute)
        setScreen("home")
        return
      }
      if (result.status === "link-expired" || result.status === "link-used") {
        if (result.intentToken && !initialIntent) {
          setIntentToken(result.intentToken)
        }
        if (result.kind && !initialIntent) {
          setKind(result.kind)
        }
        setLinkStatus(result.status)
        setScreen("expired")
        return
      }
      setScreen("signin")
    })()
    return () => {
      cancel = true
    }
  }, [client, route])

  useEffect(() => {
    if (route.kind !== "studio" || screen !== "checking" || document.visibilityState === "hidden") {
      return
    }
    let cancel = false
    void (async () => {
      const result = await client.session()
      if (cancel) {
        return
      }
      if (result.status === "signed-in") {
        if (result.kind && !initialIntent && initialKind === "home") {
          setKind(result.kind)
        }
        if (result.intentToken && !initialIntent && initialKind === "home") {
          setIntentToken(result.intentToken)
        }
        setScreen("home")
        return
      }
      setScreen("signin")
    })()
    return () => {
      cancel = true
    }
  }, [client, route, screen])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (screen !== "home") return
    let cancelled = false
    void client.session().then(result => {
      if (!cancelled && result.status === "signed-in") setAccountName(result.displayName || result.email)
    })
    return () => { cancelled = true }
  }, [client, screen])

  const secondsLeft = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000))

  const onContinue = async () => {
    if (!intentToken) {
      return
    }
    const result = await client.sendEmail(email, intentToken)
    if (result.status === "email-invalid") {
      setEmailError(copy("access.email_invalid"))
      return
    }
    if (result.status !== "check-email") {
      setEmailError(copy("access.wrong_code"))
      return
    }
    setEmailError(undefined)
    setResendAvailableAt(result.resendAvailableAt)
    setScreen("check")
  }

  const onCode = async (next = code) => {
    if (!intentToken || next.length !== 6) {
      return
    }
    const result = await client.submitCode(email, next, intentToken)
    if (result.status === "invalid-code") {
      setCode("")
      setScreen("expired")
      return
    }
    if (result.status !== "signed-in") {
      if (result.status === "link-expired" || result.status === "link-used") {
        setIntentToken(result.intentToken)
        if (result.kind) setKind(result.kind)
        setLinkStatus(result.status)
      }
      setScreen("expired")
      return
    }
    toast(copy("access.signed_in"))
    enterWorkspace(result.kind, result.intentToken, route.kind === "link" ? route.token : null)
  }

  const onResend = async () => {
    if (!intentToken || secondsLeft > 0) {
      return
    }
    const result = await client.sendEmail(email, intentToken)
    if (result.status === "check-email") {
      setResendAvailableAt(result.resendAvailableAt)
    }
  }

  const onSignOut = async () => {
    await client.revoke()
    setConfirmSignOut(false)
    setEmail("")
    setCode("")
    setIntentToken(null)
    setKind("home")
    if (route.kind === "link") {
      history.replaceState({ airdesignAccess: studioHandoff }, "", "/")
    }
    setRoute(studioRoute)
    setScreen("signin")
  }

  if (screen === "checking" || screen === "revalidating") {
    return <main className="ad-sign-in" data-screen="checking" />
  }

  if (screen === "home") {
    if (kind === "connect-agent" && intentToken && window.location.pathname === "/agents/approve") {
      return <main className="agent-approval-page"><AgentApproval intent={intentToken} client={client}/></main>
    }
    return (
      <>
        <StudioShell search={homeSearch} onSearch={searchWorkspace} onBrowse={browseWorkspace} onNavigate={navigateWorkspace} accountName={accountName} intentLabel={copy(intentCopy[kind])} showIntent={kind !== "home"} onSignOut={() => setConfirmSignOut(true)}>
          {window.location.pathname.startsWith("/settings/") ? <section className="settings-page"><h1>Settings</h1><nav className="settings-tabs" aria-label="Settings"><a href="/settings/usage" aria-current={window.location.pathname==="/settings/usage" ? "page" : undefined}>Usage</a><a href="/settings/agents" aria-current={window.location.pathname==="/settings/agents" ? "page" : undefined}>Agents</a><a href="/settings/account" aria-current={window.location.pathname==="/settings/account" ? "page" : undefined}>Account</a></nav>{window.location.pathname==="/settings/agents" ? <AgentsPanel/> : window.location.pathname==="/settings/account" ? <AccountPanel client={client}/> : <UsagePanel/>}</section> : <Workspace key={pathname === "/trash" ? "trash" : "decks"} search={homeSearch} browse={browse} startImport={kind === "import"}/>}
        </StudioShell>
        <AlertDialog
          open={confirmSignOut}
          title={copy("access.sign_out_title")}
          body={copy("access.sign_out_body")}
          onClose={() => setConfirmSignOut(false)}
          secondary={{ label: copy("common.cancel") }}
          primary={{ label: copy("access.sign_out"), onClick: () => void onSignOut() }}
        />
      </>
    )
  }

  if (screen === "expired") {
    return <main className="ad-sign-in" data-screen="expired" data-link-status={linkStatus}>
      <section className="ad-access-error">
      <BrandMark/>
      <div className="ad-access-error-copy">
      <h1 className="ad-title">{copy("access.expired_title")}</h1>
      <p className="ad-helper">{copy("access.expiry_hint")}</p>
      </div>
      <Button variant="primary" size="dialog" onClick={() => { setCode(""); setScreen("signin") }}>{copy("access.send_new")}</Button>
      </section>
    </main>
  }

  if (screen === "check") {
    return <main className="ad-sign-in" data-screen="check">
      <header className="ad-access-header"><BrandMark/><h1 className="ad-title">{copy("access.check_title")}</h1></header>
      <section className="ad-card ad-check-card">
        <span className="ad-mail-tile"><Icon name="mail"/></span>
        <p className="ad-email-target">{copy("access.email_sent")}<strong>{email}</strong></p>
        <CodeEntry label={copy("access.code_prompt")} value={code} onValueChange={next => { setCode(next); if (next.length === 6) void onCode(next) }}/>
        <div className="ad-email-apps"><a className="ad-button ad-button-secondary ad-button-dialog" href="https://outlook.live.com/mail/" target="_blank" rel="noreferrer"><MailProviderMark provider="outlook"/>{copy("access.open_outlook")}</a><a className="ad-button ad-button-secondary ad-button-dialog" href="https://mail.google.com/" target="_blank" rel="noreferrer"><MailProviderMark provider="gmail"/>{copy("access.open_gmail")}</a></div>
        <p className="ad-access-note">{copy("access.resend_prompt")} <Button variant="link" size="compact" disabled={secondsLeft > 0} onClick={() => void onResend()}>{secondsLeft > 0 ? fillCopy("access.resend_wait", { n: String(secondsLeft) }) : copy("access.resend")}</Button></p>
      </section>
      <Button variant="link" size="compact" onClick={() => { setEmail(""); setCode(""); setScreen("signin") }}><span aria-hidden="true">←</span>{copy("access.different_email")}</Button>
    </main>
  }

  return <main className="ad-sign-in" data-screen="signin">
    <header className="ad-access-header"><BrandMark/><h1 className="ad-title">{copy("access.entry_title")}</h1></header>
    <form className="ad-card" onSubmit={event => { event.preventDefault(); void onContinue() }}>
      <TextField label={copy("access.email_label")} placeholder={copy("access.email_placeholder")} type="email" inputMode="email" enterKeyHint="go" autoCapitalize="none" autoCorrect="off" autoComplete="email" value={email} error={emailError} onChange={event => setEmail(event.target.value)}/>
      <Button variant="primary" size="sign-in" type="submit" aria-label={copy("access.continue")}>{copy("access.continue_email")}</Button>
      <p className="ad-access-note">{copy("access.new_account")}</p>
    </form>
    <footer className="ad-access-legal"><a href="https://airdesign.app/terms/">{copy("access.terms")}</a> and <a href="https://airdesign.app/privacy/">{copy("access.privacy")}</a></footer>
  </main>
}
