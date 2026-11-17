import { createHash, randomBytes } from "node:crypto"
import { createRequire } from "node:module"
import { expect } from "@playwright/test"

const { settingsCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/settings-copy.ts")

function pkce() {
  const verifier = randomBytes(32).toString("base64url")
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  return { verifier, challenge }
}

async function postForm(origin, pathname, pairs) {
  const response = await fetch(`${origin}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(pairs).toString(),
  })
  return { status: response.status, json: await response.json() }
}

async function mcpInitialize(origin, pathname, accessToken) {
  const response = await fetch(`${origin}${pathname}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "journey", version: "1.0.0" },
      },
    }),
  })
  const text = await response.text()
  return { status: response.status, text }
}

export default async function drive({
  origin,
  page,
  context,
  signIn,
  post,
  capture,
  note,
  accountRoutes,
  oauthRoutes,
  mcpRoutes,
}) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)

  await page.goto("/")
  await page.getByRole("button", { name: email }).click()
  await capture("account-menu")
  await page.getByRole("menuitem", { name: "Agents" }).click()
  await expect(page).toHaveURL(/\/settings\/agents$/)
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible()
  await expect(page.getByText(settingsCopy.noAgents, { exact: true })).toBeVisible()
  await capture("agents-empty")

  const initial = await post(accountRoutes.agents, {}, cookie)
  expect(initial.status).toBe(200)
  expect(initial.json.ok).toBe(true)
  expect(initial.json.agents).toEqual([])
  const mcpAddress = initial.json.mcp
  await expect(page.getByText(mcpAddress, { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Copy", exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(mcpAddress)
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible()
  await capture("mcp-copied")
  note(`opened /settings/agents from the account menu and copied MCP address ${mcpAddress}`)

  const redirectUri = "https://claude.ai/api/mcp/auth_callback"
  const registered = await post(oauthRoutes.register, {
    client_name: "Claude",
    redirect_uris: [redirectUri],
  })
  expect(registered.status).toBe(201)
  const clientId = registered.json.client_id
  const { verifier, challenge } = pkce()
  const approved = await post(
    oauthRoutes.approve,
    {
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: mcpAddress,
    },
    cookie,
  )
  expect(approved.status).toBe(200)
  const code = new URL(approved.json.redirect).searchParams.get("code")
  expect(typeof code).toBe("string")

  const exchanged = await postForm(origin, oauthRoutes.token.path, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: redirectUri,
    resource: mcpAddress,
  })
  expect(exchanged.status).toBe(200)
  const accessToken = exchanged.json.access_token
  const refreshToken = exchanged.json.refresh_token

  const initialized = await mcpInitialize(origin, mcpRoutes.mcp.path, accessToken)
  expect(initialized.status).toBe(200)
  note("connected Claude over OAuth + PKCE and initialized /mcp with its bearer token")

  await page.reload()
  await expect(page.getByText("Claude", { exact: true })).toBeVisible()
  await expect(page.getByText("Connected just now", { exact: true })).toBeVisible()
  await capture("agents-connected")

  const listed = await post(accountRoutes.agents, {}, cookie)
  expect(listed.status).toBe(200)
  expect(listed.json.agents).toHaveLength(1)
  expect(listed.json.agents[0]).toMatchObject({
    name: "Claude",
    agent: "claude",
    host: "claude.ai",
  })

  await page.getByRole("button", { name: "Disconnect", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Disconnect Claude?" })
  await expect(
    dialog.getByText("Claude can no longer read or edit your decks. You can connect it again at any time."),
  ).toBeVisible()
  await capture("disconnect-confirm")
  await dialog.getByRole("button", { name: "Disconnect", exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Claude", { exact: true })).toHaveCount(0)
  await expect(page.getByText(settingsCopy.noAgents, { exact: true })).toBeVisible()
  await capture("agents-disconnected")

  const afterRevoke = await post(accountRoutes.agents, {}, cookie)
  expect(afterRevoke.status).toBe(200)
  expect(afterRevoke.json.agents).toEqual([])

  const refusedMcp = await mcpInitialize(origin, mcpRoutes.mcp.path, accessToken)
  expect(refusedMcp.status).toBe(401)
  const refusedRefresh = await postForm(origin, oauthRoutes.token.path, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    resource: mcpAddress,
  })
  expect([refusedRefresh.status, refusedRefresh.json]).toEqual([400, { error: "invalid_grant" }])
  note(
    "disconnected Claude from Settings; list is empty, /mcp answers 401, and refresh_token answers 400 invalid_grant",
  )
}
