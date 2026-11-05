import { useEffect, useState } from "react"
import { AlertDialog, Button, CodeEntry, TextField, copy, fillCopy, toast } from "@airdesign/ui"
import type { AccessClient, IntentKind, SessionResult } from "@airdesign/access/client"
import { StudioShell } from "../shell/studio-shell.tsx"

type Screen = "signin" | "check" | "expired" | "home"

const intentCopy: Record<IntentKind, "shell.home" | "home.new_deck" | "home.import" | "home.connect_agent"> = {
  home: "shell.home",
  "new-deck": "home.new_deck",
  import: "home.import",
  "connect-agent": "home.connect_agent",
}

export function AccessApp({ client, initialScreen = "signin", initialKind = "home", initialIntent = null }: { client: AccessClient; initialScreen?: Screen; initialKind?: IntentKind; initialIntent?: string | null }) {
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [emailError, setEmailError] = useState<string | undefined>()
  const [codeError, setCodeError] = useState<string | undefined>()
  const [intentToken, setIntentToken] = useState<string | null>(initialIntent)
  const [kind, setKind] = useState<IntentKind>(initialKind)
  const [resendAvailableAt, setResendAvailableAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [session, setSession] = useState<Extract<SessionResult, { status: "signed-in" }> | null>(null)
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  useEffect(() => {
    if (intentToken) {
      return
    }
    void client.issueIntent("home").then((issued) => {
      if (issued.status === "issued") {
        setIntentToken(issued.token)
        setKind(issued.kind)
      }
    })
  }, [client, intentToken])

  useEffect(() => {
    if (screen !== "home") {
      return
    }
    void client.session().then((result) => {
      if (result.status === "signed-out") {
        setScreen("signin")
        setSession(null)
        return
      }
      setSession(result)
    })
  }, [client, screen])

  useEffect(() => {
    if (!codeError) {
      return
    }
    document.querySelector<HTMLInputElement>(".ad-code-box")?.focus()
  }, [codeError])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

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
      setCodeError(copy("access.wrong_code"))
      return
    }
    if (result.status !== "signed-in") {
      setScreen("expired")
      return
    }
    setKind(result.kind)
    setIntentToken(result.intentToken)
    setCodeError(undefined)
    toast(copy("access.signed_in"))
    setScreen("home")
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
    setSession(null)
    setEmail("")
    setCode("")
    setScreen("signin")
  }

  if (screen === "home") {
    return (
      <>
        <StudioShell intentLabel={copy(intentCopy[kind])} showIntent={kind !== "home"} onSignOut={() => setConfirmSignOut(true)}>
          <section className="ad-empty">
            <h1 className="ad-title">{copy("home.empty_title")}</h1>
            <p className="ad-helper">{copy("home.empty_body")}</p>
            <p className="ad-helper">{session ? copy("access.signed_in") : ""}</p>
          </section>
        </StudioShell>
        <AlertDialog
          open={confirmSignOut}
          title={copy("access.sign_out_title")}
          body={copy("access.sign_out_body")}
          onClose={() => setConfirmSignOut(false)}
          secondary={{ label: copy("common.cancel") }}
          primary={{ label: copy("access.sign_out"), danger: true, onClick: () => void onSignOut() }}
        />
      </>
    )
  }

  if (screen === "expired") {
    return (
      <main className="ad-sign-in">
        <section className="ad-card">
          <h1 className="ad-title">{copy("access.expired_title")}</h1>
          <p className="ad-helper">{copy("access.expired_body")}</p>
          <Button variant="primary" size="sign-in" onClick={() => { setEmail(""); setScreen("signin") }}>{copy("access.send_new")}</Button>
        </section>
      </main>
    )
  }

  if (screen === "check") {
    return (
      <main className="ad-sign-in">
        <section className="ad-card">
          <h1 className="ad-title">{copy("access.check_title")}</h1>
          <p className="ad-helper">{copy("access.check_body")}</p>
          <CodeEntry label={copy("access.code_label")} value={code} error={codeError} onValueChange={(next) => { setCode(next); if (next.length === 6) void onCode(next) }} />
          <Button variant="secondary" size="sign-in" disabled={secondsLeft > 0} onClick={() => void onResend()}>
            {secondsLeft > 0 ? fillCopy("access.resend_wait", { n: String(secondsLeft) }) : copy("access.resend")}
          </Button>
          <Button variant="link" size="compact" onClick={() => { setEmail(""); setCode(""); setCodeError(undefined); setScreen("signin") }}>{copy("access.different_email")}</Button>
        </section>
      </main>
    )
  }

  return (
    <main className="ad-sign-in">
      <section className="ad-card">
        <h1 className="ad-title">{copy("access.sign_in_title")}</h1>
        <TextField label={copy("access.email_label")} type="email" autoComplete="email" value={email} error={emailError} onChange={(event) => setEmail(event.target.value)} />
        <Button variant="primary" size="sign-in" onClick={() => void onContinue()}>{copy("access.continue")}</Button>
      </section>
    </main>
  )
}
