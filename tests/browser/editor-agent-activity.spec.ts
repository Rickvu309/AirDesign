import { createHash, randomBytes } from "node:crypto"
import { expect, type Page } from "@playwright/test"
import * as doom from "../../packages/doom/src/index.ts"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
import { agentEditingMark } from "../../apps/web/src/copy/agent-runs-copy.ts"
import { editorCopy } from "../../apps/web/src/copy/editor-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { test, type Stack } from "./api-stack"
import { openEditor, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" })

async function saved(stack: Stack, opened: Opened) {
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const fold = doom.readFold(answer.json.fold)
  if (fold === undefined) throw new Error("no fold")
  return fold
}

async function connectClaudeCode(stack: Stack, cookie: string): Promise<string> {
  const { oauthRoutes } = await import("../../packages/catalog/src/index.ts")
  const redirect = "http://127.0.0.1:33418/callback"
  const registered = await stack.post(oauthRoutes.register.path, {
    redirect_uris: [redirect],
    client_name: "Claude Code",
  })
  const client = (registered.json as { client_id: string }).client_id
  const verifier = randomBytes(32).toString("base64url")
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  const approved = await stack.post(
    oauthRoutes.approve.path,
    { client_id: client, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: "S256" },
    cookie,
  )
  const code = new URL((approved.json as { redirect: string }).redirect).searchParams.get("code") ?? ""
  const token = await fetch(`${stack.origin}${oauthRoutes.token.path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: client,
      redirect_uri: redirect,
    }),
  })
  return ((await token.json()) as { access_token: string }).access_token
}

function agentCall(stack: Stack, token: string) {
  let id = 0
  return async (tool: string, args: unknown): Promise<Record<string, unknown>> => {
    const response = await fetch(`${stack.origin}${stack.mcp}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: (id += 1),
        method: "tools/call",
        params: { name: `airdesign_${tool}`, arguments: args },
      }),
    })
    const text = await response.text()
    const line = text.startsWith("{")
      ? text
      : (text
          .split("\n")
          .find((each) => each.startsWith("data: "))
          ?.slice(6) ?? "")
    return (JSON.parse(line) as { result: { structuredContent: Record<string, unknown> } }).result.structuredContent
  }
}

async function ask(page: Page, text: string) {
  await page.locator("[data-editor-panel]").getByRole("textbox", { name: airaCopy.askAira }).fill(text)
  await page.keyboard.press("Enter")
}

const note = (slide: string, text: string, y: number) => ({
  op: "add",
  kind: "text",
  slide,
  text,
  box: { x: 160, y, w: 800, h: 80 },
})

test("the mark shows while an agent writes, leaves after thirty quiet seconds with the run still open, and a late write continues the run", async ({
  page,
  context,
  stack,
}) => {
  await page.clock.install()
  const opened = await openEditor(page, context, stack)
  const side = page.locator("[data-editor-panel]")
  const canvas = page.locator("[data-slide-box]")
  const label = page.locator("[data-slide-label]")
  const mark = label.getByRole("button", { name: agentEditingMark(["Claude Code"], { here: true }) })
  const call = agentCall(stack, await connectClaudeCode(stack, opened.cookie))

  const first = await call("edit_deck", {
    deck: opened.deck,
    base: (await saved(stack, opened)).rev,
    changes: [note(opened.slide, "Agent note", 820)],
  })
  expect(first.ok, JSON.stringify(first)).toBe(true)
  await expect(canvas.getByText("Agent note", { exact: true })).toBeVisible()
  await expect(mark).toBeVisible()
  await expect(side.getByText("Claude Code")).toHaveCount(0)

  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await expect(side.locator("[data-aira-panel]")).toBeHidden()
  await mark.click()
  await expect(side.locator("[data-aira-panel]")).toBeVisible()

  await page.clock.fastForward(31_000)
  await expect(label.locator("[data-agent-at-work]")).toHaveCount(0)
  expect((await saved(stack, opened)).runs.get(String(first.runId))?.phase).toBe("running")

  const late = await call("edit_deck", {
    deck: opened.deck,
    base: (await saved(stack, opened)).rev,
    runId: first.runId,
    changes: [note(opened.slide, "Late note", 700)],
  })
  expect(late.ok, JSON.stringify(late)).toBe(true)
  await expect(canvas.getByText("Late note", { exact: true })).toBeVisible()
  await expect(mark).toBeVisible()
  expect((await saved(stack, opened)).runs.get(String(first.runId))).toMatchObject({ phase: "running" })
})

test("Undo in Aira's chat takes back only Aira's run, leaves another agent's work, and a reload keeps it", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const side = page.locator("[data-editor-panel]")
  const log = side.getByRole("log")
  const canvas = page.locator("[data-slide-box]")
  const call = agentCall(stack, await connectClaudeCode(stack, opened.cookie))
  const first = await call("edit_deck", {
    deck: opened.deck,
    base: (await saved(stack, opened)).rev,
    changes: [note(opened.slide, "Agent note", 820)],
  })
  expect((await call("stop_run", { deck: opened.deck, runId: first.runId })).ok).toBe(true)
  await expect(canvas.getByText("Agent note", { exact: true })).toBeVisible()

  stack.aira(
    {
      name: "add-two-texts.sse",
      fill: { deck: opened.deck, base: String((await saved(stack, opened)).rev), slide: opened.slide },
    },
    { name: "added-two-texts.sse" },
  )
  await ask(page, "Add a summary and a note")
  await expect(canvas.getByText("Draft note", { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  const undo = side.getByRole("button", { name: productCopy.undo, exact: true })
  await expect(undo).toHaveCount(1)

  await log.getByRole("button", { name: productCopy.undo, exact: true }).click()
  await expect(canvas.getByText("Draft note", { exact: true })).toHaveCount(0)
  await expect(log.getByText(airaCopy.undone, { exact: true })).toBeVisible()
  await expect(canvas.getByText("Agent note", { exact: true })).toBeVisible()

  await page.locator("[data-canvas-stage]").focus()
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(canvas.getByText("Draft note", { exact: true })).toBeVisible()
  await undo.click()
  await expect(canvas.getByText("Draft note", { exact: true })).toHaveCount(0)

  await expect
    .poll(async () =>
      [...(await saved(stack, opened)).runs].map(([id, run]) => [id === first.runId, run.undone === true]),
    )
    .toEqual(
      expect.arrayContaining([
        [true, false],
        [false, true],
      ]),
    )
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await expect(undo).toHaveCount(0)
  await expect(canvas.getByText("Agent note", { exact: true })).toBeVisible()
  await expect(canvas.getByText("Draft note", { exact: true })).toHaveCount(0)
})
