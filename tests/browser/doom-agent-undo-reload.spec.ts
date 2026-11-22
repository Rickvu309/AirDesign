import { expect, type Page } from "@playwright/test"
import { doom } from "../../packages/document/src/index.ts"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { test, type Stack } from "./api-stack"
import { openDoomEditor, type Opened } from "./doom-deck"

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

test("Undo takes an agent's run back after the tab reloaded, reading only that run's edits", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  const base = (await saved(stack, opened)).rev
  const side = page.locator("[data-editor-panel]")
  const canvas = page.locator("[data-slide-box]")
  const before = await canvas.locator("[data-node]").count()
  stack.aira(
    { name: "add-kpi.sse", fill: { deck: opened.deck, base: String(base), slide: opened.slide } },
    { name: "added-kpi.sse" },
  )
  await expect(side.getByText(airaCopy.welcome)).toBeVisible()
  await ask(page, asked)
  await expect(canvas.getByText("$4.2M", { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)

  const requested: string[] = []
  await page.reload()
  page.on("request", (request) => requested.push(new URL(request.url()).pathname))
  await expect(canvas.getByText("$4.2M", { exact: true })).toBeVisible()
  await side.getByRole("button", { name: productCopy.undo, exact: true }).click()
  await expect(canvas.getByText("$4.2M", { exact: true })).toHaveCount(0)
  await expect.poll(async () => await canvas.locator("[data-node]").count()).toBe(before)
  expect(requested).toContain("/doom/run")
  await expect
    .poll(async () => (await saved(stack, opened)).children.get(opened.slide as doom.NodeId)?.length)
    .toBe(before)
})
