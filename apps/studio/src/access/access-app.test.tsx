import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { chromium } from "playwright"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AccessClient, IntentKind, VerifyResult } from "@airdesign/access/client"
import { AccessApp } from "./access-app.tsx"

let root: Root | null = null

beforeEach(()=>{vi.stubGlobal("fetch",vi.fn(async()=>Response.json([])))})

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  root = null
  document.body.innerHTML = ""
  history.replaceState(null, "", "/")
  vi.unstubAllGlobals()
})

describe("studio access", () => {
  it("preserves the search query when a returning session is still signed in", async () => {
    await render(<AccessApp client={fakeClient({signedIn:true})} initialScreen="checking" />)
    await act(flush)
    await act(async () => { setValue(document.querySelector<HTMLInputElement>('input[type="search"]'), "Strategy"); await flush() })
    await act(async () => { window.dispatchEvent(new Event("pagehide")) })
    expect(document.querySelector(".ad-shell")).toBeNull()
    await act(async () => {
      window.dispatchEvent(Object.assign(new Event("pageshow"), {persisted:true}))
      await flush()
    })
    expect(document.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe("Strategy")
  })


  it("preserves the email sign-in flow when switching tabs", async () => {
    await render(<AccessApp client={fakeClient()} />)
    const field = document.querySelector<HTMLInputElement>('input[type="email"]')
    await act(async () => {
      setValue(field, "ada@example.com")
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(document.querySelector('input[type="email"]')).toBe(field)
    expect(field?.value).toBe("ada@example.com")
    expect(document.querySelector('[data-screen="signin"]')).not.toBeNull()
  })

  it("conceals private content before the page enters the back/forward cache", async () => {
    await render(<AccessApp client={fakeClient({signedIn:true})} initialScreen="checking" />)
    await act(flush)
    expect(document.querySelector(".ad-shell")).not.toBeNull()
    await act(async () => { window.dispatchEvent(new Event("pagehide")) })
    expect(document.querySelector(".ad-shell")).toBeNull()
    expect(document.querySelector('[data-screen="checking"]')).not.toBeNull()
  })

  it("removes private data before pageshow session validation finishes", async () => {
    const client = fakeClient({signedIn:true})
    await render(<AccessApp client={client} initialScreen="checking" />)
    await act(flush)
    expect(document.querySelector(".ad-shell")).not.toBeNull()
    let finish: (value: Awaited<ReturnType<AccessClient["session"]>>) => void = () => { throw new Error("session-not-requested") }
    client.session = () => new Promise(resolve => { finish = resolve })
    await act(async () => {
      window.dispatchEvent(Object.assign(new Event("pageshow"), {persisted:true}))
    })
    expect(document.querySelector(".ad-shell")).toBeNull()
    expect(document.querySelector('[data-screen="checking"]')).not.toBeNull()
    await act(async () => { finish({status:"signed-out"}); await flush() })
    expect(document.querySelector('[data-screen="signin"]')).not.toBeNull()
    expect(document.querySelector(".ad-shell")).toBeNull()
    expect(location.pathname).toBe("/")
  })

  it("keeps the signed-in workspace mounted across tab switches while the session is valid", async () => {
    await render(<AccessApp client={fakeClient({signedIn:true})} initialScreen="checking" />)
    await act(flush)
    const shell = document.querySelector(".ad-shell")
    expect(shell).not.toBeNull()
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await flush() })
    expect(document.querySelector(".ad-shell")).toBe(shell)
  })

  it("clears private data on tab return when the session ended elsewhere", async () => {
    const client = fakeClient({signedIn:true})
    await render(<AccessApp client={client} initialScreen="checking" />)
    await act(flush)
    expect(document.querySelector(".ad-shell")).not.toBeNull()
    client.session = async () => ({status:"signed-out"})
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await flush() })
    expect(document.querySelector(".ad-shell")).toBeNull()
    expect(document.querySelector('[data-screen="signin"]')).not.toBeNull()
    expect(location.pathname).toBe("/")
  })

  it("keeps a valid session on the restored private route", async () => {
    history.replaceState(null, "", "/settings/agents")
    await render(<AccessApp client={fakeClient({signedIn:true})} initialScreen="checking" />)
    await act(flush)
    await act(async () => { window.dispatchEvent(new Event("pagehide")) })
    await act(async () => {
      window.dispatchEvent(Object.assign(new Event("pageshow"), {persisted:true}))
      await flush()
    })
    expect(document.body.textContent).toContain("Connected agents")
    expect(location.pathname).toBe("/settings/agents")
    expect(document.querySelector(".ad-shell")).not.toBeNull()
  })

  it("keeps private content concealed when session validation fails", async () => {
    const client = fakeClient({signedIn:true})
    await render(<AccessApp client={client} initialScreen="checking" />)
    await act(flush)
    client.session = async () => { throw new Error("offline") }
    await act(async () => {
      window.dispatchEvent(Object.assign(new Event("pageshow"), {persisted:true}))
      await flush()
    })
    expect(document.querySelector('[data-screen="signin"]')).not.toBeNull()
    expect(document.querySelector(".ad-shell")).toBeNull()
  })

  it("explains account creation and links to the legal policies before asking for email", async () => {
    await render(<AccessApp client={fakeClient()} />)
    expect(document.querySelector("h1")?.textContent).toBe("Sign in or create an account")
    expect(document.body.textContent).toContain("New email? The same link creates your account.")
    expect(document.querySelector('a[href="https://airdesign.app/terms/"]')?.textContent).toBe("Terms of Service")
    expect(document.querySelector('a[href="https://airdesign.app/privacy/"]')?.textContent).toBe("Privacy Policy")
    expect(document.querySelector('input[type="email"]')?.getAttribute("autocomplete")).toBe("email")
  })

  it("switches browse routes without losing loaded decks or list mode", async () => {
    const requests: string[] = []
    vi.stubGlobal("fetch", async (input: string) => {
      requests.push(input)
      return Response.json(input.startsWith("/api/catalog") ? [{ id: "example", title: "Strategy", slides: 1, updated: Date.now(), deletedAt: null, generation: 1 }] : { name: "Ada" })
    })
    await render(<AccessApp client={fakeClient({ signedIn: true })} initialScreen="checking" />)
    await act(flush)
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="List view"]')?.click())
    const deck = document.querySelector(".deck-card")
    expect(deck?.textContent).toContain("Strategy")
    const catalogRequests = requests.filter(request => request.startsWith("/api/catalog")).length
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>(".ad-nav-item")].find(button => button.textContent === "All decks")?.click())
    expect(location.search).toBe("?browse=all")
    expect(document.querySelector("h1")?.textContent).toBe("All decks")
    expect(document.querySelector(".deck-card")).toBe(deck)
    expect(document.querySelector('[aria-label="List view"]')?.getAttribute("aria-pressed")).toBe("true")
    expect(requests.filter(request => request.startsWith("/api/catalog"))).toHaveLength(catalogRequests)
    await act(async () => { history.replaceState(history.state, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")) })
    expect(document.querySelector("h1")?.textContent).toBe("Recents")
    expect(document.querySelector(".deck-card")).toBe(deck)
  })

  it.each(["/settings/usage", "/settings/agents", "/settings/account", "/trash"])("searches decks from %s while preserving focus and the query", async (destination) => {
    history.replaceState(null, "", destination)
    const requests: string[] = []
    vi.stubGlobal("fetch", async (input: string) => {
      requests.push(input)
      if (input === "/api/usage") return Response.json({ payments: { kind: "unavailable" }, used: 0, remaining: 10000, paid: 0, bonus: 0, autoReset: false, week: { zone: "UTC", resetsAt: 1804483200000 } })
      if (input === "/api/usage/history") return Response.json({ items: [], nextCursor: null })
      return Response.json(input.startsWith("/api/catalog") ? [{ id: "strategy", title: "Strategy", slides: 1, updated: Date.now(), deletedAt: null, generation: 1 }] : {})
    })
    await render(<AccessApp client={fakeClient()} initialScreen="home" />)
    const search = document.querySelector<HTMLInputElement>('input[type="search"]')
    search?.focus()
    await act(async () => { setValue(search, "Strategy"); await flush() })
    expect(location.pathname).toBe("/")
    expect(document.querySelector("h1")?.textContent).toBe("All decks")
    expect(document.querySelector(".deck-card")?.textContent).toContain("Strategy")
    expect(requests.some(request => request.includes("search=Strategy") && !request.includes("trash=true"))).toBe(true)
    expect(document.activeElement).toBe(search)
    expect(search?.value).toBe("Strategy")
  })

  it("keeps the discovery import action over a saved home session", async () => {
    await render(<AccessApp client={fakeClient({signedIn:true,kind:"home"})} initialScreen="checking" initialKind="import" />)
    await act(flush)
    expect(document.body.textContent).toContain("Import PowerPoint")
    expect(document.querySelector(".import-card")).not.toBeNull()
  })

  it("shows the approval account without the workspace and preserves the URL intent over a saved session intent", async () => {
    const requests: string[] = []
    vi.stubGlobal("fetch", async (input: string) => {
      requests.push(input)
      return Response.json({ client: "Reference agent", scope: "decks", expired: false })
    })
    history.replaceState(null, "", "/agents/approve?intent=approval-from-url")
    await render(<AccessApp client={fakeClient({ signedIn: true, kind: "import" })} initialScreen="checking" initialKind="connect-agent" initialIntent="approval-from-url" />)
    await act(flush)
    expect(requests).toContain("/api/agents/approval?intent=approval-from-url")
    expect(document.body.textContent).toContain("Reference agent wants to use AirDesign")
    expect(document.body.textContent).toContain("ada@example.com")
    expect(document.querySelector(".ad-studio-shell")).toBeNull()
    expect(document.querySelector(".agent-approval-page")).not.toBeNull()
  })

  it("opens settings when a session still carries an earlier connect intent", async () => {
    vi.stubGlobal("fetch", async () => Response.json([]))
    history.replaceState(null, "", "/settings/agents")
    await render(<AccessApp client={fakeClient({ signedIn: true, kind: "connect-agent" })} initialScreen="checking" />)
    await act(flush)
    expect(document.body.textContent).toContain("Connected agents")
    expect(document.querySelector(".agent-approval")).toBeNull()
  })

  it("offers recovery for a wrong code and keeps the same destination", async () => {
    const client = fakeClient()
    await render(<AccessApp client={client} />)
    await act(async () => {
      await flush()
    })
    const email = document.querySelector<HTMLInputElement>("input")
    const button = document.querySelector<HTMLButtonElement>("button.ad-button-primary")
    await act(async () => {
      setValue(email, "ada@example.com")
      button?.click()
      await flush()
    })
    expect(document.querySelector("h1")?.textContent).toBe("Check your email")
    const boxes = [...document.querySelectorAll<HTMLInputElement>(".ad-code-box")]
    expect(boxes[0]?.autocomplete).toBe("one-time-code")
    expect(document.activeElement).toBe(boxes[0])
    await act(async () => {
      const paste = new Event("paste", { bubbles: true, cancelable: true })
      Object.defineProperty(paste, "clipboardData", { value: { getData: () => "000000" } })
      boxes[0]?.dispatchEvent(paste)
      await flush()
    })
    expect(document.querySelector("h1")?.textContent).toBe("This link has expired")
    await act(async () => { document.querySelector<HTMLButtonElement>(".ad-button-primary")?.click(); await flush() })
    expect(document.querySelector<HTMLInputElement>("input[type=email]")?.value).toBe("ada@example.com")
  })

  it("clears the email when the person switches address", async () => {
    const client = fakeClient()
    await render(<AccessApp client={client} />)
    await act(async () => {
      await flush()
    })
    const email = document.querySelector<HTMLInputElement>("input")
    await act(async () => {
      setValue(email, "ada@example.com")
      ;[...document.querySelectorAll("button")].find((item) => item.textContent === "Continue with email")?.click()
      await flush()
    })
    await act(async () => {
      ;[...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Use a different email"))?.click()
    })
    expect(document.querySelector("h1")?.textContent).toBe("Sign in or create an account")
    expect(document.querySelector("input")?.value).toBe("")
    expect(document.body.textContent).not.toContain("ada@example.com")
  })

  it("returns focus from the sign-out dialog", async () => {
    const client = fakeClient({ signedIn: true })
    await render(<AccessApp client={client} initialScreen="home" />)
    await act(async () => {
      await flush()
    })
    const trigger = document.querySelector<HTMLElement>('[aria-label="Account menu"]')!
    await act(async () => trigger.click())
    await act(async () => {
      ;[...document.querySelectorAll("button")].find((item) => item.textContent === "Sign out")?.click()
    })
    expect(document.querySelector("[role=dialog]")).not.toBeNull()
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    expect(document.querySelector("[role=dialog]")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("shows the saved intent on the home shell", async () => {
    const client = fakeClient({ signedIn: true, kind: "import" })
    const started = performance.now()
    await render(<AccessApp client={client} initialScreen="home" initialKind="import" initialIntent="signed-intent" />)
    const shellStartupMs = performance.now() - started
    const evidence = path.join(process.env.HOME ?? "", "tmp/airdesign-autopilot/P01/perf")
    mkdirSync(evidence, { recursive: true })
    writeFileSync(path.join(evidence, "w02-shell.json"), `${JSON.stringify({ shellStartupMs, budgetMs: 3000, trunk: "absent" }, null, 2)}\n`)
    expect(shellStartupMs).toBeLessThan(3000)
    await act(async () => {
      await flush()
    })
    expect(document.querySelector('[aria-label="Workspace sidebar"]')).not.toBeNull()
    expect(document.querySelector("[role=status]")?.textContent).toContain("Import a PowerPoint")
    expect(document.querySelector("h1")?.textContent).toBe("Recents")
  })

  it("opens an email link into the saved intent", async () => {
    const client = fakeClient({
      link: { status: "signed-in", personId: "person", intentToken: "import-intent", kind: "import" },
    })
    await render(<AccessApp client={client} route={{ kind: "link", token: "link-token" }} initialScreen="checking" />)
    await act(async () => {
      await flush()
    })
    expect(document.querySelector("h1")?.textContent).toBe("Recents")
    expect(document.querySelector("[role=status]")?.textContent).toContain("Import a PowerPoint")
  })

  it("keeps the intent when a link is used again and offers a new send", async () => {
    const sent: string[] = []
    const client = fakeClient({
      link: { status: "link-used", screen: "S29.01", intentToken: "import-intent", kind: "import" },
      onSend(intent) {
        sent.push(intent)
      },
    })
    await render(<AccessApp client={client} route={{ kind: "link", token: "used-token" }} initialScreen="checking" />)
    await act(async () => {
      await flush()
    })
    expect(document.querySelector("[data-link-status]")?.getAttribute("data-link-status")).toBe("link-used")
    await act(async () => {
      ;[...document.querySelectorAll("button")].find((item) => item.textContent === "Send a new link")?.click()
    })
    const email = document.querySelector<HTMLInputElement>("input")
    await act(async () => {
      setValue(email, "ada@example.com")
      ;[...document.querySelectorAll("button")].find((item) => item.textContent === "Continue with email")?.click()
      await flush()
    })
    expect(document.querySelector("h1")?.textContent).toBe("Check your email")
    expect(sent).toEqual(["import-intent"])
  })

  it("shows phone-width recovery for an expired link", async () => {
    const client = fakeClient({
      link: { status: "link-expired", screen: "S29.01", intentToken: "import-intent", kind: "import" },
    })
    document.documentElement.style.width = "320px"
    await render(<AccessApp client={client} route={{ kind: "link", token: "expired-token" }} initialScreen="checking" />)
    await act(async () => {
      await flush()
    })
    expect(document.querySelector("h1")?.textContent).toBe("This link has expired")
    expect(document.querySelector(".ad-helper")?.textContent).toContain("Sign-in links work once")
    expect(document.querySelector(".ad-sign-in")).not.toBeNull()
  })

  it("keeps the workspace when the handed-off link is mounted again", async () => {
    history.replaceState(null, "", "/access/link?token=once")
    let claims = 0
    const client = fakeClient({
      signedIn: true,
      kind: "import",
      link: { status: "signed-in", personId: "person", intentToken: "import-intent", kind: "import" },
    })
    const consume = client.consumeLink.bind(client)
    client.consumeLink = async (token) => {
      claims += 1
      if (claims > 1) {
        return { status: "link-used", screen: "S29.01", intentToken: "import-intent", kind: "import" }
      }
      return consume(token)
    }
    await render(<AccessApp client={client} route={{ kind: "link", token: "once" }} initialScreen="checking" />)
    await act(async () => {
      await flush()
    })
    expect(location.pathname).toBe("/")
    expect(document.querySelector("#shell")).not.toBeNull()
    expect(claims).toBe(1)
    await act(async () => {
      root?.unmount()
    })
    root = null
    document.body.innerHTML = ""
    await render(<AccessApp client={client} route={{ kind: "link", token: "once" }} initialScreen="checking" />)
    await act(async () => {
      await flush()
    })
    expect(document.querySelector("#shell")).not.toBeNull()
    expect(document.querySelector("[data-screen=expired]")).toBeNull()
    expect(claims).toBe(1)
  })

  it("issues a home intent after sign-out from a link sign-in", async () => {
    history.replaceState(null, "", "/access/link?token=handoff")
    let issued = 0
    const client = fakeClient({
      signedIn: true,
      kind: "import",
      link: { status: "signed-in", personId: "person", intentToken: "import-intent", kind: "import" },
    })
    const issue = client.issueIntent.bind(client)
    client.issueIntent = async (next) => {
      issued += 1
      return issue(next)
    }
    await render(<AccessApp client={client} route={{ kind: "link", token: "handoff" }} initialScreen="checking" />)
    await act(async () => {
      await flush()
    })
    expect(issued).toBe(0)
    await act(async () => {
      ;[...document.querySelectorAll("button")].find((item) => item.textContent === "Sign out")?.click()
    })
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[role="dialog"] button.ad-button-primary')?.click()
      await flush()
    })
    expect(document.querySelector("[data-screen=signin]")).not.toBeNull()
    expect(issued).toBe(1)
    const email = document.querySelector<HTMLInputElement>("input")
    await act(async () => {
      setValue(email, "ada@example.com")
      ;[...document.querySelectorAll("button")].find((item) => item.textContent === "Continue with email")?.click()
      await flush()
    })
    expect(document.querySelector("h1")?.textContent).toBe("Check your email")
  })

  it("rejects a used link that was not handed off to the studio url", async () => {
    history.replaceState({ airdesignAccess: "studio", consumedLinkToken: "other" }, "", "/access/link?token=again")
    const client = fakeClient({
      signedIn: true,
      kind: "import",
      link: { status: "link-used", screen: "S29.01", intentToken: "import-intent", kind: "import" },
    })
    await render(<AccessApp client={client} route={{ kind: "link", token: "again" }} initialScreen="checking" />)
    await act(async () => {
      await flush()
    })
    expect(document.querySelector("#shell")).toBeNull()
    expect(document.querySelector("[data-link-status=link-used]")).not.toBeNull()
  })

  it("restores a signed-in import intent after a reload and returns to sign-in when the cookie is revoked", async () => {
    const signedIn = fakeClient({ signedIn: true, kind: "import" })
    await render(<AccessApp client={signedIn} initialScreen="checking" />)
    await act(async () => {
      await flush()
    })
    expect(document.querySelector("h1")?.textContent).toBe("Recents")
    expect(document.querySelector("[role=status]")?.textContent).toContain("Import a PowerPoint")
    root?.unmount()
    document.body.innerHTML = ""
    const revoked = fakeClient({ signedIn: false })
    await render(<AccessApp client={revoked} initialScreen="checking" />)
    await act(async () => {
      await flush()
    })
    expect(document.querySelector("h1")?.textContent).toBe("Sign in or create an account")
  })
})

function setValue(input: HTMLInputElement | null | undefined, value: string) {
  if (!input) {
    return
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

async function render(node: ReactNode) {
  document.body.innerHTML = `<div id="root"></div>`
  const host = document.getElementById("root")
  if (!host) {
    throw new Error("missing root")
  }
  root = createRoot(host)
  await act(async () => {
    root?.render(node)
  })
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function fakeClient(options: { signedIn?: boolean; kind?: IntentKind; link?: VerifyResult; onSend?: (intent: string) => void } = {}): AccessClient {
  const kind = options.kind ?? "home"
  return {
    async issueIntent(next) {
      return { status: "issued", token: "signed-intent", kind: next }
    },
    async sendEmail(email, intent) {
      options.onSend?.(intent)
      if (!email.includes("@")) {
        return { status: "email-invalid" }
      }
      return { status: "check-email", resendAvailableAt: Date.now() + 30_000 }
    },
    async submitCode() {
      return { status: "invalid-code", screen: "S29.01" }
    },
    async consumeLink() {
      return options.link ?? { status: "link-expired", screen: "S29.01", intentToken: "signed-intent", kind }
    },
    async session() {
      if (!options.signedIn) {
        return { status: "signed-out" }
      }
      return { status: "signed-in", personId: "person", email: "ada@example.com", displayName: "ada", freeUsageWeekStartedAt: null, intentToken: "signed-intent", kind }
    },
    async revoke() {
      return { status: "signed-out" }
    },
    async account() {
      return this.session()
    },
    async readPerson() {
      return { status: "not-found" }
    },
    async updatePerson() {
      return { status: "not-found" }
    },
    async deleteAccount() {
      return { status: "confirmation-required" }
    },
  }
}

it("exposes the painted email action by its exact accessible name", async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent(renderToStaticMarkup(<AccessApp client={fakeClient({})} />))
    expect(await page.getByRole("button", { name: "Continue with email", exact: true }).count()).toBe(1)
  } finally {
    await browser.close()
  }
})
