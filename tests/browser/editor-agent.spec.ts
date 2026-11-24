import { expect, type Page } from "@playwright/test"
import * as doom from "../../packages/doom/src/index.ts"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { test, type Stack } from "./api-stack"
import { openEditor, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" })

const asked = "Add three KPIs to this slide"

async function saved(stack: Stack, opened: Opened) {
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const fold = doom.readFold(answer.json.fold)
  if (fold === undefined) throw new Error("no fold")
  return fold
}

async function ask(page: Page, text: string) {
  await page.locator("[data-editor-panel]").getByRole("textbox", { name: airaCopy.askAira }).fill(text)
  await page.keyboard.press("Enter")
}

test("Aira adds KPIs through the MCP address, the canvas paints them as they land, and Undo takes the run back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const base = (await saved(stack, opened)).rev
  const side = page.locator("[data-editor-panel]")
  const canvas = page.locator("[data-slide-box]")
  const before = await canvas.locator("[data-node]").count()
  await page.evaluate(() => {
    document.body.dataset.sameLoad = "yes"
  })
  stack.aira(
    { name: "add-kpi.sse", fill: { deck: opened.deck, base: String(base), slide: opened.slide } },
    { name: "added-kpi.sse" },
  )
  await expect(side.getByText(airaCopy.welcome)).toBeVisible()
  await ask(page, asked)
  await expect(canvas.getByText("$4.2M", { exact: true })).toBeVisible()
  await expect(canvas.getByText("Customers", { exact: true })).toBeVisible()
  expect(await canvas.locator("[data-node]").count()).toBeGreaterThan(before)
  await expect(side.getByText("I will add three KPIs to the slide.", { exact: true })).toBeVisible()
  await expect(side.getByText("The slide now shows revenue, customers and churn.", { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  await expect
    .poll(async () => [...(await saved(stack, opened)).runs.values()].map((run) => run.phase))
    .toEqual(["stopped"])
  const added = await saved(stack, opened)
  expect(added.children.get(opened.slide as doom.NodeId)?.length).toBeGreaterThan(before)

  await side.getByRole("log").getByRole("button", { name: productCopy.undo, exact: true }).click()
  await expect(canvas.getByText("$4.2M", { exact: true })).toHaveCount(0)
  await expect.poll(async () => await canvas.locator("[data-node]").count()).toBe(before)
  await expect(side.getByText(airaCopy.undone, { exact: true })).toBeVisible()
  await expect
    .poll(async () => (await saved(stack, opened)).children.get(opened.slide as doom.NodeId)?.length)
    .toBe(before)
  expect(await page.evaluate(() => document.body.dataset.sameLoad)).toBe("yes")
})

test("Stop ends Aira's turn before its edit lands and the deck stays as it was", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  const base = (await saved(stack, opened)).rev
  const side = page.locator("[data-editor-panel]")
  const canvas = page.locator("[data-slide-box]")
  const requests: string[] = []
  page.on("request", (request) => requests.push(new URL(request.url()).pathname))
  stack.aira({
    name: "add-kpi.sse",
    fill: { deck: opened.deck, base: String(base), slide: opened.slide },
    holdAfter: 3,
  })
  const reached = stack.hold()
  await ask(page, asked)
  await reached
  await expect(side.getByText("I will add", { exact: true })).toBeVisible()
  await side.getByRole("button", { name: "Stop" }).click()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  await expect(side.getByRole("textbox", { name: airaCopy.askAira })).toBeVisible()
  stack.release()
  await expect(canvas.getByText("$4.2M", { exact: true })).toHaveCount(0)
  expect(requests).not.toContain("/mcp")
  expect((await saved(stack, opened)).rev).toBe(base)
})

test("Stop while Aira's edit is on its way spends its call, so the edit arriving after Stop lands nothing", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const base = (await saved(stack, opened)).rev
  const side = page.locator("[data-editor-panel]")
  const canvas = page.locator("[data-slide-box]")
  stack.aira({ name: "add-kpi.sse", fill: { deck: opened.deck, base: String(base), slide: opened.slide } })
  let sent: string | undefined
  const inFlight = new Promise<void>((reached) => {
    void page.route("**/mcp", (route) => {
      const request = route.request()
      sent = request.postData() ?? ""
      reached()
    })
  })
  const stopped = page.waitForResponse((response) => new URL(response.url()).pathname === "/aira/stop")
  await ask(page, asked)
  await inFlight
  await side.getByRole("button", { name: "Stop" }).click()
  expect(JSON.parse((await stopped).request().postData() ?? "{}")).toMatchObject({ call: { deck: opened.deck } })
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  const spent = (await saved(stack, opened)).rev
  expect(spent).toBe(base + 1)

  if (sent === undefined) throw new Error("no edit call")
  const late = await fetch(`${stack.origin}${stack.mcp}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      cookie: opened.cookie,
    },
    body: sent,
  })
  expect(late.status, await late.text()).toBe(200)
  const after = await saved(stack, opened)
  expect(after.rev).toBe(spent)
  expect(after.runs.size).toBe(0)
  await expect(canvas.getByText("$4.2M", { exact: true })).toHaveCount(0)
  await expect(side.getByRole("log").getByRole("button", { name: productCopy.undo, exact: true })).toHaveCount(0)
})
