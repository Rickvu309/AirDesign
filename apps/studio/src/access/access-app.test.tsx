import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
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

  it("keeps a wrong code on the check screen and returns focus to the code", async () => {
    const client = fakeClient()
    await render(<AccessApp client={client} />)
    await act(async () => {
      await flush()
    })
    const email = document.querySelector<HTMLInputElement>("input")
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent === "Continue")
    await act(async () => {
      setValue(email, "ada@example.com")
      button?.click()
      await flush()
    })
    expect(document.querySelector("h1")?.textContent).toBe("Check your email")
    const boxes = [...document.querySelectorAll<HTMLInputElement>(".ad-code-box")]
    expect(boxes[0]?.autocomplete).toBe("one-time-code")
    await act(async () => {
      const paste = new Event("paste", { bubbles: true, cancelable: true })
      Object.defineProperty(paste, "clipboardData", { value: { getData: () => "000000" } })
      boxes[0]?.dispatchEvent(paste)
      await flush()
    })
    expect(document.querySelector("[role=alert]")?.textContent).toBe("That code is not valid. Try again.")
    expect(document.querySelector("h1")?.textContent).toBe("Check your email")
    expect(document.activeElement).toBe(document.querySelector(".ad-code-box"))
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
      ;[...document.querySelectorAll("button")].find((item) => item.textContent === "Continue")?.click()
      await flush()
    })
    await act(async () => {
      ;[...document.querySelectorAll("button")].find((item) => item.textContent === "Use a different email")?.click()
    })
    expect(document.querySelector("h1")?.textContent).toBe("Sign in")
    expect(document.querySelector("input")?.value).toBe("")
    expect(document.body.textContent).not.toContain("ada@example.com")
  })

  it("returns focus from the sign-out dialog", async () => {
    const client = fakeClient({ signedIn: true })
    await render(<AccessApp client={client} initialScreen="home" />)
    await act(async () => {
      await flush()
    })
    const trigger = [...document.querySelectorAll("button")].find((item) => item.textContent === "Sign out")
    trigger?.focus()
    await act(async () => {
      trigger?.click()
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
    expect(document.querySelector("[role=status]")?.textContent).toContain("Your place is saved.")
    expect(document.querySelector("[role=status]")?.textContent).toContain("Import a PowerPoint")
    expect(document.body.textContent).toContain("No decks yet")
  })

  it("opens an email link into the saved intent", async () => {
    const client = fakeClient({
      link: { status: "signed-in", personId: "person", intentToken: "import-intent", kind: "import" },
    })
    await render(<AccessApp client={client} route={{ kind: "link", token: "link-token" }} initialScreen="checking" />)
    await act(async () => {
      await flush()
    })
    expect(document.querySelector("h1")?.textContent).toBe("No decks yet")
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
    expect(document.querySelector("[role=status]")?.textContent).toContain("Import a PowerPoint")
    await act(async () => {
      ;[...document.querySelectorAll("button")].find((item) => item.textContent === "Send a new link")?.click()
    })
    const email = document.querySelector<HTMLInputElement>("input")
    await act(async () => {
      setValue(email, "ada@example.com")
      ;[...document.querySelectorAll("button")].find((item) => item.textContent === "Continue")?.click()
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
    expect(document.querySelector("[role=status]")?.textContent).toContain("Your place is saved.")
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
      document.querySelector<HTMLButtonElement>("button.ad-button-danger")?.click()
      await flush()
    })
    expect(document.querySelector("[data-screen=signin]")).not.toBeNull()
    expect(issued).toBe(1)
    const email = document.querySelector<HTMLInputElement>("input")
    await act(async () => {
      setValue(email, "ada@example.com")
      ;[...document.querySelectorAll("button")].find((item) => item.textContent === "Continue")?.click()
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
    expect(document.querySelector("h1")?.textContent).toBe("No decks yet")
    expect(document.querySelector("[role=status]")?.textContent).toContain("Import a PowerPoint")
    root?.unmount()
    document.body.innerHTML = ""
    const revoked = fakeClient({ signedIn: false })
    await render(<AccessApp client={revoked} initialScreen="checking" />)
    await act(async () => {
      await flush()
    })
    expect(document.querySelector("h1")?.textContent).toBe("Sign in")
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
      return { status: "invalid-code", screen: "S22.01" }
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
