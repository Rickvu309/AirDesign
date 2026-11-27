import { createHash, randomBytes, randomUUID } from "node:crypto"
import { expect } from "@playwright/test"
import { airaCopy, airaStepWords, undoCopy } from "../bin/product-copy.mjs"

const asked = "Add a results grid to this slide"

async function doomAgent(kit, cookie) {
  const { page, post, capture, note, doomRoutes, mcpRoutes, aira, holdReply } = kit
  await page.goto("/s")
  await page.locator("[data-editor-ready]").waitFor()
  const deck = new URL(page.url()).pathname.slice("/s/".length)
  const opened = (await post(doomRoutes.open, { deck }, cookie)).json
  const slide = Object.values(opened.fold.nodes).find((node) => node.type === "slide").id
  const side = page.locator("[data-editor-panel]")
  const log = side.getByRole("log")
  const canvas = page.locator("[data-slide-box]")
  const composer = side.getByRole("textbox", { name: airaCopy.askAira })
  await expect(composer).toBeVisible()
  await capture("doom-agent-panel")
  note(`opened doom deck ${deck} at revision ${String(opened.rev)}; the Agent panel shows the Ask Aira composer`)

  aira([{ name: "add-results-grid.sse", fill: { deck, slide } }, { name: "added-results-grid.sse" }])
  const { release } = await holdReply(mcpRoutes.mcp)
  await composer.fill(asked)
  await page.keyboard.press("Enter")
  await expect(log.getByText(asked, { exact: true })).toBeVisible()
  await expect(log.getByText("I will add a results grid to the slide.", { exact: true })).toBeVisible()
  await expect(log.locator('[data-tool-state="working"]')).toHaveText(airaStepWords.execute.working)
  await expect(side.getByRole("button", { name: "Stop" })).toBeVisible()
  await capture("working")
  note("the reply streamed and the Editing slides step waits on /mcp with Stop showing")

  await release()
  await expect(canvas.getByText("$4.2M", { exact: true })).toBeVisible()
  await expect(log.getByText("The slide now shows revenue, customers and churn.", { exact: true })).toBeVisible()
  await expect(log.locator('[data-tool-state="done"]')).toHaveText(airaStepWords.execute.done)
  await expect(log.getByRole("button", { name: undoCopy.undo })).toBeVisible()
  await capture("done")
  note("the call went through /mcp and the canvas painted the results grid without a reload")
  return { deck, slide }
}

async function outsideAgentToken(kit, cookie, name) {
  const { origin, post, accountRoutes, oauthRoutes } = kit
  const mcp = (await post(accountRoutes.agents, {}, cookie)).json.mcp
  const redirectUri = "http://127.0.0.1:33418/callback"
  const registered = await post(oauthRoutes.register, { client_name: name, redirect_uris: [redirectUri] })
  const verifier = randomBytes(32).toString("base64url")
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  const pairs = { client_id: registered.json.client_id, redirect_uri: redirectUri }
  const approved = await post(
    oauthRoutes.approve,
    { ...pairs, code_challenge: challenge, code_challenge_method: "S256", resource: mcp },
    cookie,
  )
  const code = new URL(approved.json.redirect).searchParams.get("code")
  const exchanged = await fetch(`${origin}${oauthRoutes.token.path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...pairs,
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      resource: mcp,
    }),
  })
  return (await exchanged.json()).access_token
}

export async function connectOutsideAgent(kit, cookie, name, read = (result) => result.structuredContent) {
  const { origin, mcpRoutes } = kit
  const token = await outsideAgentToken(kit, cookie, name)
  return async (tool, args) => {
    const response = await fetch(`${origin}${mcpRoutes.mcp.path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: `airdesign_${tool}`, arguments: args },
      }),
    })
    const text = await response.text()
    const line = text.startsWith("{")
      ? text
      : text
          .split("\n")
          .find((each) => each.startsWith("data: "))
          .slice(6)
    return read(JSON.parse(line).result)
  }
}

async function outsideAgent(kit, cookie, { deck, slide }) {
  const { page, post, capture, note, doomRoutes } = kit
  const call = await connectOutsideAgent(kit, cookie, "Claude Code")
  const landed = await call("execute", {
    deck,
    script: `insert({ parent: "${slide}", kind: "text", text: "Churn fell to 2.1% after the Q3 pricing change", box: { x: 160, y: 150, w: 1200, h: 80 } })`,
  })
  expect(landed.ok).toBe(true)
  const mark = page.locator("[data-agent-at-work]")
  await expect(mark).toHaveText("Claude Code is editing this slide")
  await capture("outside-editing")
  note(
    `Claude Code, connected over OAuth, edited the open deck at rev ${String(landed.rev)}; the slide label row names it`,
  )

  expect((await call("stop_run", { deck, runId: landed.runId })).ok).toBe(true)
  await expect(mark).toHaveCount(0)
  await expect(page.locator("[data-editor-panel]").getByText("Claude Code")).toHaveCount(0)
  await capture("outside-stopped")
  note("Claude Code stopped its run: the mark left the canvas and the Agent panel shows only Aira's chat")
}

export default async function drive(kit) {
  const { signIn, note } = kit
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  const opened = await doomAgent(kit, cookie)
  await outsideAgent(kit, cookie, opened)
  const { page, post, capture, doomRoutes } = kit
  const { deck } = opened
  const saved = (await post(doomRoutes.open, { deck }, cookie)).json
  const nodes = new Map(Object.values(saved.fold.nodes).map((node) => [node.id, node]))
  let revenue = [...nodes.values()].find((node) => node.text?.chars === "$4.2M")
  expect(revenue).toBeDefined()
  while (revenue.parent?.id !== opened.slide) {
    revenue = nodes.get(revenue.parent?.id)
    expect(revenue).toBeDefined()
  }
  const changed = await post(
    doomRoutes.edit,
    {
      deck,
      edit: {
        once: randomUUID(),
        author: { kind: "person", id: "another-tab" },
        writes: [{ node: revenue.id, prop: "name", value: "Revenue panel" }],
      },
    },
    cookie,
  )
  expect(changed.json).toMatchObject({ ok: true })
  const log = page.locator("[data-editor-panel]").getByRole("log")
  await log.getByRole("button", { name: undoCopy.undo }).click()
  await expect(log.getByText(/“Revenue panel”/)).toBeVisible()
  await capture("aira-undo-kept-layer")
  await expect(log).toContainText("“Revenue panel” stays because it was changed after Aira made it.")
  await expect(page.locator("[data-slide-box]").getByText("$4.2M", { exact: true })).toBeVisible()
}
