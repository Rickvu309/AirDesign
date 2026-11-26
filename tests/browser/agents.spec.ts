import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { connectAgentCopy, connectedOf, setupPromptOf, waitingOf } from "../../apps/web/src/copy/connect-agent-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { settingsCopy } from "../../apps/web/src/copy/settings-copy"

test.use({ reducedMotion: "reduce" })

type AgentRow = {
  id: string
  name: string | null
  agent: "claude" | "claude-code" | "codex" | "other"
  host: string
  connected: string
}

const mcpAddress = "https://mcp.airdesign.test/mcp"

async function mockHome(page: Page, email = "person@example.com") {
  await page.route("**/decks/list", (route) =>
    route.fulfill({
      json: { ok: true, account: { email }, decks: [], trash: [] },
    }),
  )
}

function listAgents(page: Page, agents: () => AgentRow[]) {
  return page.route("**/account/agents", (route) =>
    route.fulfill({
      json: { ok: true, account: { email: "person@example.com" }, mcp: mcpAddress, agents: agents() },
    }),
  )
}

const connectDialog = (page: Page) => page.getByRole("dialog", { name: connectAgentCopy.title })

test("reaches Agents from the Home account menu, lists each agent by name alone, and disconnects one after confirming", async ({
  page,
}) => {
  await mockHome(page)

  let agents: AgentRow[] = [
    {
      id: "grant-claude",
      name: "Claude",
      agent: "claude",
      host: "claude.ai",
      connected: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    },
    {
      id: "grant-other",
      name: null,
      agent: "other",
      host: "127.0.0.1:8124",
      connected: new Date().toISOString(),
    },
  ]
  const revoked: unknown[] = []

  await listAgents(page, () => agents)
  await page.route("**/account/agents/revoke", async (route) => {
    const body = route.request().postDataJSON() as { id: string }
    revoked.push(body)
    agents = agents.filter((item) => item.id !== body.id)
    await route.fulfill({ json: { ok: true } })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "person@example.com" }).click()
  await page.getByRole("menuitem", { name: "Agents" }).click()

  await expect(page).toHaveURL(/\/settings\/agents$/)
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Agents", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: settingsCopy.usage, exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Account", exact: true })).toBeVisible()

  await expect(page.getByText("Claude", { exact: true })).toBeVisible()
  await expect(page.getByText("127.0.0.1:8124", { exact: true })).toBeVisible()
  await expect(page.getByText(/^Connected /)).toHaveCount(0)
  await expect(page.getByText(mcpAddress, { exact: true })).toHaveCount(0)

  const disconnectButtons = page.getByRole("button", { name: "Disconnect", exact: true })
  await expect(disconnectButtons).toHaveCount(2)
  await disconnectButtons.first().click()

  const dialog = page.getByRole("dialog", { name: "Disconnect Claude?" })
  await expect(
    dialog.getByText("Claude can no longer read or edit your decks. You can connect it again at any time."),
  ).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
  expect(revoked).toEqual([])

  await disconnectButtons.first().click()
  await dialog.getByRole("button", { name: "Disconnect", exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(revoked).toEqual([{ id: "grant-claude" }])
  await expect(page.getByText("Claude", { exact: true })).toHaveCount(0)
  await expect(page.getByText("127.0.0.1:8124", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Disconnect", exact: true }).click()
  const secondDialog = page.getByRole("dialog", { name: "Disconnect 127.0.0.1:8124?" })
  await secondDialog.getByRole("button", { name: "Disconnect", exact: true }).click()
  expect(revoked).toEqual([{ id: "grant-claude" }, { id: "grant-other" }])
  await expect(page.getByRole("heading", { name: settingsCopy.noAgents, exact: true })).toBeVisible()
})

test("the connect dialog gives an app the address and a coding agent a prompt, then says which agent connected without a reload", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await mockHome(page)
  let agents: AgentRow[] = []
  await listAgents(page, () => agents)

  await page.goto("/settings/agents")
  await page.getByRole("button", { name: connectAgentCopy.title }).click()
  const dialog = connectDialog(page)

  await expect(dialog.getByRole("button", { name: "Claude", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(dialog.getByText(mcpAddress, { exact: true })).toBeVisible()
  await expect(dialog.getByRole("link", { name: "Open Claude connectors" })).toHaveAttribute(
    "href",
    "https://claude.ai/customize/connectors",
  )
  await dialog.getByRole("button", { name: connectAgentCopy.copy, exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(mcpAddress)
  await expect(dialog.getByRole("button", { name: productCopy.done, exact: true })).toBeVisible()

  await dialog.getByRole("button", { name: "Claude Code", exact: true }).click()
  await expect(dialog.getByText(waitingOf("Claude Code"), { exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: connectAgentCopy.copyPrompt, exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(setupPromptOf(mcpAddress))

  await dialog.getByRole("button", { name: "Gemini", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Gemini CLI", exact: true })).toHaveAttribute("aria-pressed", "true")
  await dialog.getByRole("button", { name: "Antigravity", exact: true }).click()
  await expect(dialog.getByText(waitingOf("Antigravity"), { exact: true })).toBeVisible()

  await dialog.getByRole("button", { name: "Other", exact: true }).click()
  await expect(dialog.getByText(mcpAddress, { exact: true })).toBeVisible()
  await expect(dialog.getByRole("link")).toHaveCount(0)

  agents = [
    {
      id: "grant-code",
      name: "Claude Code",
      agent: "claude-code",
      host: "127.0.0.1",
      connected: new Date().toISOString(),
    },
  ]
  const connected = page.getByRole("dialog", { name: connectedOf("Claude Code") })
  await expect(connected).toBeVisible()
  await expect(connected.getByText(connectAgentCopy.connectedBody, { exact: true })).toBeVisible()
  await expect(connected.getByRole("button")).toHaveCount(1)
  await connected.getByRole("button", { name: productCopy.done, exact: true }).click()
  await expect(connected).toBeHidden()
  await expect(page.getByText("Claude Code", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toHaveCount(1)
})

test("a list answer that arrives late never replaces a newer one, so a connected agent stays listed", async ({
  page,
}) => {
  await mockHome(page)
  let agents: AgentRow[] = []
  let hold = false
  let held!: () => void
  const heldArrived = new Promise<void>((resolve) => {
    held = resolve
  })
  let release!: () => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/account/agents", async (route) => {
    const answer = { ok: true, account: { email: "person@example.com" }, mcp: mcpAddress, agents }
    if (hold) {
      hold = false
      held()
      await released
    }
    await route.fulfill({ json: answer })
  })

  await page.goto("/settings/agents")
  await expect(page.getByRole("heading", { name: settingsCopy.noAgents, exact: true })).toBeVisible()

  hold = true
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await heldArrived
  await page.getByRole("button", { name: connectAgentCopy.title }).click()
  await expect(connectDialog(page).getByText(mcpAddress, { exact: true })).toBeVisible()
  agents = [
    {
      id: "grant-code",
      name: "Claude Code",
      agent: "claude-code",
      host: "127.0.0.1",
      connected: "2026-11-26T00:00:00Z",
    },
  ]
  const connected = page.getByRole("dialog", { name: connectedOf("Claude Code") })
  await connected.getByRole("button", { name: productCopy.done, exact: true }).click()
  await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toHaveCount(1)

  const late = page.waitForResponse("**/account/agents")
  release()
  await late
  await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toHaveCount(1)
  await expect(page.getByText(settingsCopy.noAgents, { exact: true })).toHaveCount(0)
})

test("the connect dialog asks for the list one request at a time and closes from its Close button", async ({
  page,
}) => {
  await mockHome(page)
  let inFlight = 0
  let most = 0
  let seen = 0
  let secondArrived!: () => void
  const second = new Promise<void>((resolve) => {
    secondArrived = resolve
  })
  let release!: () => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.goto("/")
  await page.route("**/account/agents", async (route) => {
    seen += 1
    inFlight += 1
    most = Math.max(most, inFlight)
    if (seen === 1) {
      inFlight -= 1
      return route.fulfill({ status: 500, body: "failed" })
    }
    if (seen === 2) {
      secondArrived()
      await released
    }
    inFlight -= 1
    await route.fulfill({
      json: { ok: true, account: { email: "person@example.com" }, mcp: mcpAddress, agents: [] },
    })
  })

  await page.locator("[data-decks-sidebar]").getByRole("button", { name: connectAgentCopy.title }).click()
  const dialog = connectDialog(page)
  const retry = dialog.getByRole("button", { name: "Try again", exact: true })
  await expect(retry).toBeVisible()
  await second
  await retry.click()
  release()
  await expect(dialog.getByText(mcpAddress, { exact: true })).toBeVisible()
  expect(most).toBe(1)

  await dialog.getByRole("button", { name: productCopy.close, exact: true }).click()
  await expect(dialog).toBeHidden()
})

test("renders empty, loading, failed, and signed-out states without a blank page", async ({ page }) => {
  let unblockLoad!: () => void
  let blockFirstLoad: Promise<void> | null = new Promise<void>((resolve) => {
    unblockLoad = resolve
  })
  let shouldFail = true

  await page.route("**/account/agents", async (route) => {
    if (blockFirstLoad !== null) {
      const wait = blockFirstLoad
      blockFirstLoad = null
      await wait
    }
    if (shouldFail) {
      await route.fulfill({ status: 500, body: "failed" })
      return
    }
    await route.fulfill({
      json: {
        ok: true,
        account: { email: "person@example.com" },
        mcp: mcpAddress,
        agents: [],
      },
    })
  })

  await page.goto("/settings/agents")
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: settingsCopy.agents, exact: true })).toBeVisible()
  await expect(page.getByText(settingsCopy.noAgents, { exact: true })).toHaveCount(0)

  unblockLoad()
  const retry = page.getByRole("button", { name: "Try again", exact: true })
  await expect(retry).toBeVisible()
  await expect(page.getByText(settingsCopy.noAgents, { exact: true })).toHaveCount(0)

  await page.getByRole("button", { name: connectAgentCopy.title }).click()
  const dialog = connectDialog(page)
  await expect(dialog.getByRole("alert")).toHaveText(new RegExp(`^${connectAgentCopy.loadFailed}`))
  shouldFail = false
  await dialog.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(dialog.getByText(mcpAddress, { exact: true })).toBeVisible()
  await page.keyboard.press("Escape")

  await expect(page.getByRole("heading", { name: settingsCopy.noAgents, exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: connectAgentCopy.title })).toBeVisible()
})

test("signed out on /settings/agents goes to sign-in with the path and query", async ({ page }) => {
  await page.route("**/account/agents", (route) =>
    route.fulfill({ status: 401, json: { ok: false, refusal: "session" } }),
  )
  await page.route("**/sign-in?*", (route) => route.fulfill({ body: "Sign in" }))
  await page.goto("/settings/agents?source=menu")
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings%2Fagents%3Fsource%3Dmenu$/)
})

test("selects the address and says how to copy it when clipboard access fails", async ({ page }) => {
  await mockHome(page)
  await listAgents(page, () => [])
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    })
  })
  await page.goto("/settings/agents")
  await expect(page.getByRole("heading", { name: settingsCopy.noAgents, exact: true })).toBeVisible()
  const sidebar = page.locator("[data-decks-sidebar]")
  await expect(sidebar.getByRole("button", { name: connectAgentCopy.title })).toHaveCount(0)

  await page.getByRole("button", { name: connectAgentCopy.title }).click()
  const dialog = connectDialog(page)
  await expect(dialog.getByRole("status")).toHaveText("")
  await dialog.getByRole("button", { name: connectAgentCopy.copy, exact: true }).click()
  await expect(dialog.getByRole("button", { name: connectAgentCopy.copyFailed, exact: true })).toBeVisible()
  await expect(dialog.getByRole("status")).toHaveText(connectAgentCopy.copyManually)
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(mcpAddress)
  await page.keyboard.press("Escape")

  await page.getByRole("link", { name: settingsCopy.usage, exact: true }).click()
  await expect(sidebar.getByRole("button", { name: connectAgentCopy.title })).toBeVisible()
})
