import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { deckRoutes, oauthRoutes } from "@airdesign/catalog"
import { OAuthAuthorize } from "@/connect/oauth-authorize"

const query = new URLSearchParams({
  client_id: "client",
  redirect_uri: "https://claude.ai/api/mcp/auth_callback",
  response_type: "code",
  code_challenge: "a".repeat(43),
  code_challenge_method: "S256",
  state: "keep-me",
  resource: "https://studio.airdesign.app/mcp",
})
const address = `/oauth/authorize?${query}`
const fetcher = vi.fn<typeof fetch>()
let host: HTMLDivElement
let root: Root
let close: () => void

beforeAll(async () => {
  const name = "jsdom"
  const { JSDOM } = (await import(name)) as {
    JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis }
  }
  const { window } = new JSDOM("<!doctype html><html><body></body></html>", { url: `http://localhost${address}` })
  close = () => window.close()
  for (const [key, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(key, value)
  vi.stubGlobal("fetch", fetcher)
})
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
  fetcher.mockReset()
})
afterAll(() => {
  close()
  vi.unstubAllGlobals()
})

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}
function consent(screen = "claude") {
  fetcher.mockResolvedValueOnce(reply({ ok: true, screen, redirect_host: "agent.example" }))
  fetcher.mockResolvedValueOnce(reply({ ok: true, account: { email: "ada@example.com" } }))
}
async function mount() {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<OAuthAuthorize />))
}
async function allow() {
  const button = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Allow")
  expect(button).toBeDefined()
  await act(async () => button?.click())
}
function recovery(transient: boolean) {
  expect(host.textContent).not.toContain("Check your connection")
  expect(host.textContent).toContain(transient ? "Try again in a moment." : "Start connecting again from your agent")
  const link = host.querySelector("a")
  expect(link?.textContent).toBe(transient ? "Try again" : "Back to AirDesign")
  expect(link?.getAttribute("href")).toBe(transient ? address : "/")
  expect(host.querySelector("button")).toBeNull()
}

it("shows loading without a consent decision before the client rule answers", () => {
  const markup = renderToStaticMarkup(<OAuthAuthorize />)
  expect(markup).toContain('role="status"')
  expect(markup).toContain("Loading connection request…")
  expect(markup).not.toContain("<button")
})
it.each([
  ["claude", "Claude"],
  ["codex", "Codex on this computer"],
  ["claude-code", "Claude Code on this computer"],
  ["gemini", "Gemini"],
  ["other", "agent.example"],
])("describes only supported access and costs for %s", async (screen, destination) => {
  consent(screen)
  await mount()
  expect(host.textContent).toContain("Read and edit all your decks")
  expect(host.textContent).not.toMatch(/brand and files|Import and export PowerPoint|Uses your weekly usage/)
  expect(host.textContent).toContain(`Returns you to ${destination}.`)
  expect(host.textContent).toContain("Disconnect anytime in Settings.")
})
it("names Gemini and shows its mark beside AirDesign's", async () => {
  consent("gemini")
  await mount()
  expect(host.querySelector("h1")?.textContent).toBe("Gemini wants to use AirDesign")
  expect(host.textContent).toContain("Gemini will be able to")
  expect(host.textContent).not.toContain("agent.example")
  expect(host.querySelectorAll("main > section > div:first-child img")).toHaveLength(1)
})
it.each(["network", "server", "rate", "malformed", "refusal"])("recovers from a %s consent lookup", async (failure) => {
  if (failure === "network") fetcher.mockRejectedValueOnce(new TypeError("offline"))
  else
    fetcher.mockResolvedValueOnce(
      reply(
        failure === "refusal" ? { ok: false, refusal: "client" } : {},
        failure === "server" ? 503 : failure === "rate" ? 429 : failure === "refusal" ? 400 : 200,
      ),
    )
  await mount()
  recovery(failure === "network" || failure === "server" || failure === "rate")
})
it.each(["network", "server", "rate", "malformed", "refusal", "unsafe redirect"])(
  "does not replay an approval after a %s answer",
  async (failure) => {
    consent()
    await mount()
    if (failure === "network") fetcher.mockRejectedValueOnce(new TypeError("offline"))
    else
      fetcher.mockResolvedValueOnce(
        reply(
          failure === "refusal"
            ? { ok: false, refusal: "challenge" }
            : failure === "unsafe redirect"
              ? { ok: true, redirect: "javascript:alert(1)" }
              : {},
          failure === "server" ? 503 : failure === "rate" ? 429 : failure === "refusal" ? 400 : 200,
        ),
      )
    await allow()
    recovery(failure === "network" || failure === "server" || failure === "rate")
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      oauthRoutes.client.path,
      deckRoutes.list.path,
      oauthRoutes.approve.path,
    ])
  },
)
it.each(["network", "server", "rate", "malformed"])("recovers from a %s account lookup", async (failure) => {
  fetcher.mockResolvedValueOnce(reply({ ok: true, screen: "claude", redirect_host: "claude.ai" }))
  if (failure === "network") fetcher.mockRejectedValueOnce(new TypeError("offline"))
  else fetcher.mockResolvedValueOnce(reply({}, failure === "server" ? 503 : failure === "rate" ? 429 : 200))
  await mount()
  recovery(failure === "network" || failure === "server" || failure === "rate")
})
