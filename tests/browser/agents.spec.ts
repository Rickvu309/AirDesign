import { expect, test, type Page } from "@playwright/test"
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

test("reaches Agents from the Home account menu, copies the MCP address, disconnects an agent after confirming, and leaves out unbacked controls", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
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

  await page.route("**/account/agents", (route) =>
    route.fulfill({
      json: {
        ok: true,
        account: { email: "person@example.com" },
        mcp: mcpAddress,
        agents,
      },
    }),
  )
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
  await expect(page.getByRole("heading", { name: "MCP server", exact: true })).toBeVisible()
  await expect(page.getByText(mcpAddress, { exact: true })).toBeVisible()

  await expect(page.getByRole("switch", { name: "Aira" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Connect", exact: true })).toHaveCount(0)
  await expect(page.getByText("Setup guides for Claude and Codex")).toHaveCount(0)
  await expect(page.getByRole("link", { name: settingsCopy.usage, exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Account", exact: true })).toBeVisible()

  await page.getByRole("button", { name: settingsCopy.copy, exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(mcpAddress)
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible()

  await expect(page.getByText("Claude", { exact: true })).toBeVisible()
  await expect(page.getByText("Connected 2 hours ago", { exact: true })).toBeVisible()
  await expect(page.getByText("127.0.0.1:8124", { exact: true })).toBeVisible()
  await expect(page.getByText("Connected just now", { exact: true })).toBeVisible()

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
  await expect(page.getByText(settingsCopy.noAgents, { exact: true })).toBeVisible()
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
  await expect(page.getByRole("heading", { name: "MCP server", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: settingsCopy.copy, exact: true })).toBeDisabled()
  await expect(page.getByText(settingsCopy.noAgents, { exact: true })).toHaveCount(0)

  unblockLoad()
  const retry = page.getByRole("button", { name: "Try again", exact: true })
  await expect(retry).toBeVisible()
  await expect(page.getByText(settingsCopy.noAgents, { exact: true })).toHaveCount(0)

  shouldFail = false
  await retry.click()
  await expect(page.getByText(settingsCopy.noAgents, { exact: true })).toBeVisible()
  await expect(page.getByText(mcpAddress, { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: settingsCopy.copy, exact: true })).toBeEnabled()
})

test("signed out on /settings/agents goes to sign-in with the path and query", async ({ page }) => {
  await page.route("**/account/agents", (route) =>
    route.fulfill({ status: 401, json: { ok: false, refusal: "session" } }),
  )
  await page.route("**/sign-in?*", (route) => route.fulfill({ body: "Sign in" }))
  await page.goto("/settings/agents?source=menu")
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings%2Fagents%3Fsource%3Dmenu$/)
})

test("explains how to connect and selects the address when clipboard access fails", async ({ page }) => {
  await mockHome(page)
  await page.route("**/account/agents", (route) =>
    route.fulfill({
      json: { ok: true, account: { email: "person@example.com" }, mcp: mcpAddress, agents: [] },
    }),
  )
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    })
  })
  await page.goto("/settings/agents")
  await expect(page.getByText(settingsCopy.noAgents, { exact: true })).toBeVisible()
  await expect(page.getByText(settingsCopy.connectAgent)).toBeVisible()
  await expect(page.getByRole("link", { name: "Connect an agent" })).toHaveCount(0)
  await expect(page.getByRole("status")).toHaveText("")
  await page.getByRole("button", { name: settingsCopy.copy, exact: true }).click()
  await expect(page.getByRole("button", { name: settingsCopy.copyFailed, exact: true })).toBeVisible()
  await expect(page.getByRole("status")).toHaveText(settingsCopy.copyManually)
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(mcpAddress)
  await page.getByRole("link", { name: settingsCopy.usage, exact: true }).click()
  await expect(page.getByRole("link", { name: "Connect an agent" })).toBeVisible()
})
