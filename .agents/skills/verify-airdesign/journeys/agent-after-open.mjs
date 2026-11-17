import path from "node:path"
import { expect } from "@playwright/test"

export default async function drive({ repo, origin, page, signIn, post, capture, note, deckRoutes, mcpRoutes, aira }) {
  const { cookie } = await signIn()
  let id = 0
  async function tool(name, args) {
    const response = await fetch(new URL(mcpRoutes.mcp.path, origin), {
      method: "POST",
      headers: { cookie, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
    })
    expect(response.status).toBe(200)
    const text = await response.text()
    const body = text.startsWith("event:")
      ? text
          .split("\n")
          .find((line) => line.startsWith("data: "))
          .slice(6)
      : text
    return JSON.parse(body).result.structuredContent
  }
  const words = (text) => JSON.stringify([{ from: 0, runs: [{ from: -1, text }] }])
  const side = page.locator("[data-editor-panel]")
  const log = side.getByRole("log")
  const composer = side.getByRole("textbox", { name: "Ask Aira" })
  const entries = page.locator("[data-slide-entry]")
  const slide = page.locator("[data-slide-paint]")

  await page.goto("/")
  let release = () => undefined
  const held = new Promise((resolve) => {
    release = resolve
  })
  const indexing = (url) => url.pathname === deckRoutes.index.path
  await page.route(indexing, async (route) => {
    await held
    await route.fallback()
  })
  const opened = page.waitForResponse((response) => new URL(response.url()).pathname === deckRoutes.open.path)
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/blank.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await opened
  aira([{ name: "add-slide.sse", fill: { deck, base: "0" } }, { name: "edited.sse" }])
  await composer.fill("Add a slide")
  await composer.press("Enter")
  await expect(log.getByText("Adding a slide")).toBeVisible()
  const outside = await tool("airdesign_add_slide", { deck, base: 0, after: "256", layout: "256" })
  expect(outside).toMatchObject({ ok: false, refusal: "indexing" })
  await page.waitForTimeout(2500)
  await expect(log.getByText("Adding a slide")).toBeVisible()
  await expect(log.getByText("Couldn't add a slide")).toHaveCount(0)
  await capture("adding-while-indexing")
  release()
  await expect(log.getByText("Added a slide")).toBeVisible({ timeout: 30_000 })
  await expect(entries).toHaveCount(2, { timeout: 30_000 })
  await page.unroute(indexing)
  await capture("added-after-indexing")
  note(
    "with the deck's index held, an outside add_slide was refused indexing and Aira's step stayed Adding a slide; once the index landed it read Added a slide and the deck had two slides",
  )

  const read = await tool("airdesign_read_deck", { deck })
  expect(read.index).toBe("ready")
  const first = read.slides[0].id
  const nodes = read.elements.filter((each) => each.slide === first).map((each) => each.node)
  expect(nodes.length).toBeGreaterThanOrEqual(2)
  const both = await Promise.all(
    nodes.slice(0, 2).map((node, n) =>
      tool("airdesign_edit_deck", {
        deck,
        base: read.revision,
        changes: [{ node, readAt: 0, value: words(`Parallel ${String(n + 1)}`) }],
      }),
    ),
  )
  expect(both.map((each) => each.ok)).toEqual([true, true])
  expect(both[1].runId).toBe(both[0].runId)
  await entries.first().click()
  await expect(slide.getByText("Parallel 1")).toBeVisible()
  await expect(slide.getByText("Parallel 2")).toBeVisible()
  const pair = await Promise.all([
    tool("airdesign_add_slide", { deck, base: read.revision + 2, after: first, layout: first }),
    tool("airdesign_edit_deck", {
      deck,
      base: read.revision + 2,
      changes: [{ node: nodes[0], readAt: 1, value: words("Parallel 3") }],
    }),
  ])
  expect(pair.map((each) => each.ok)).toEqual([true, true])
  expect(pair.map((each) => each.runId)).toEqual([both[0].runId, both[0].runId])
  await expect(entries).toHaveCount(3)
  await expect(slide.getByText("Parallel 3")).toBeVisible()
  await capture("parallel")
  note(
    `two edits sent at once, then a slide call and an edit at once, all landed in one run ${both[0].runId} and painted`,
  )

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const fresh = page.url().split("/").at(-1)
  const title = slide.locator('[contenteditable="true"]')
  await expect(title).toHaveText("Hello")
  const base = (await post(deckRoutes.open, { deck: fresh }, cookie)).json.revision
  aira([{ name: "edit.sse", fill: { deck: fresh, base: String(base), node: "256.2" } }, { name: "edited.sse" }])
  let answer = () => undefined
  const answered = new Promise((resolve) => {
    answer = resolve
  })
  let reach = () => undefined
  const reached = new Promise((resolve) => {
    reach = resolve
  })
  const calling = (url) => url.pathname === mcpRoutes.mcp.path
  await page.route(calling, async (route) => {
    const landed = await route.fetch()
    reach()
    await answered
    await route.fulfill({ response: landed }).catch(() => undefined)
  })
  await composer.fill("Change the title to Hello from Aira")
  await composer.press("Enter")
  await reached
  await side.getByRole("button", { name: "Stop" }).click()
  answer()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  await expect(log.getByText("Edited slides", { exact: true })).toBeVisible()
  await expect(title).toHaveText("Hello from Aira")
  await expect(side.getByRole("button", { name: "Undo", exact: true })).toBeEnabled()
  await page.unroute(calling)
  const stored = (await post(deckRoutes.open, { deck: fresh }, cookie)).json.register.elements["256.2"]
  await capture("stopped-after-landing")
  note(
    `Stop after the edit reached the server: the step reads Edited slides, the title reads Hello from Aira, Undo is offered for the edit that landed, and the server's element is ${stored.phase}`,
  )
}
