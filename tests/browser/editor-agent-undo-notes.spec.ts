import { expect, type BrowserContext, type Page } from "@playwright/test"
import { airaCopy, airaKeptLayerName } from "../../apps/web/src/copy/aira-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import * as doom from "../../packages/doom/src/index.ts"
import { forward, test, type Stack } from "./api-stack"
import { accent, clickSlide, landNodes, openEditor, savedNode, selectedIds, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const blue = [{ kind: "solid", color: { var: "accent4" } }]
const author = { kind: "agent", id: "helper", name: "Helper", run: "run-notes" }

async function runOf(stack: Stack, opened: { deck: string; cookie: string }, writes: readonly unknown[]) {
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  for (const edit of [
    { once: "notes-1", author, phase: "start", writes },
    { once: "notes-2", author, phase: "stop", writes: [] },
  ])
    expect((await stack.post(doomRoutes.edit.path, { deck: opened.deck, edit }, opened.cookie)).json.ok).toBe(true)
}

async function otherTab(context: BrowserContext, stack: Stack, deck: string): Promise<Page> {
  const other = await context.newPage()
  await forward(other, stack)
  await other.goto(`/s/${deck}`)
  await other.locator("[data-editor-ready]").waitFor()
  return other
}

test("Undo on an agent run that deleted a layer from a frame another tab deleted says it can't come back until that frame is back", async ({
  page,
  context,
  stack,
}) => {
  const { undoStaysNote } = await import("../../packages/catalog/src/index.ts")
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:91", type: "frame", parent: opened.slide, props: { box: spot(100, 200, 500, 500), fills: accent } },
    {
      id: "t:92",
      type: "shape",
      parent: "t:91",
      props: { box: spot(100, 100, 200, 100), geometry: { kind: "rect" }, fills: blue, name: "Card" },
    },
  ])
  await runOf(stack, opened, [{ node: "t:92", prop: "parent", value: null }])
  await expect.poll(async () => (await savedNode(stack, opened, "t:92"))?.parent).toBeNull()

  const other = await otherTab(context, stack, opened.deck)
  await clickSlide(other, 130, 230)
  await expect.poll(() => selectedIds(other)).toEqual(["t:91"])
  await other.keyboard.press("Delete")
  await expect.poll(async () => (await savedNode(stack, opened, "t:91"))?.parent).toBeNull()

  const row = page.locator('[data-agent-run="run-notes"]')
  await row.locator("[data-agent-run-undo]").click()
  await expect(row.locator("[data-agent-run-note]")).toHaveText(
    undoStaysNote("Helper", { kept: [], left: [], waiting: [airaKeptLayerName("Card")] }),
  )
  await expect(page.locator('[data-slide-box] [data-node="t:92"]')).toHaveCount(0)
  await other.close()
})

test("Undo on an agent run whose frame now holds the person's layer names the frame it keeps, not nothing left to undo", async ({
  page,
  context,
  stack,
}) => {
  const { undoStaysNote } = await import("../../packages/catalog/src/index.ts")
  const opened = await openEditor(page, context, stack)
  const { orderKeyBetween } = doom
  await runOf(stack, opened, [
    { node: "t:95", prop: "type", value: "frame" },
    { node: "t:95", prop: "parent", value: { id: opened.slide, at: orderKeyBetween(null, null) } },
    { node: "t:95", prop: "box", value: spot(100, 200, 500, 500) },
    { node: "t:95", prop: "fills", value: accent },
    { node: "t:95", prop: "name", value: "Panel" },
  ])
  await expect.poll(async () => (await savedNode(stack, opened, "t:95"))?.name).toBe("Panel")
  await landNodes(stack, opened, [
    {
      id: "t:96",
      type: "shape",
      parent: "t:95",
      props: { box: spot(100, 100, 200, 100), geometry: { kind: "rect" }, fills: blue },
    },
  ])

  const row = page.locator('[data-agent-run="run-notes"]')
  await expect(page.locator('[data-slide-box] [data-node="t:96"]')).toHaveCount(1)
  await row.locator("[data-agent-run-undo]").click()
  await expect(row.locator("[data-agent-run-note]")).toHaveText(
    undoStaysNote("Helper", { kept: [airaKeptLayerName("Panel")], left: [], waiting: [] }),
  )
  expect(((await savedNode(stack, opened, "t:96"))?.parent as { id: string }).id).toBe("t:95")
})

test("Undo on Aira's request whose frame now holds the person's layer names the frame in the chat and keeps Undo", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const { doomRoutes, undoStaysNote } = await import("../../packages/catalog/src/index.ts")
  const saved = async () => {
    const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
    const fold = doom.readFold(answer.json.fold)
    if (fold === undefined) throw new Error("no fold")
    return fold
  }
  const side = page.locator("[data-editor-panel]")
  stack.aira(
    { name: "add-frame.sse", fill: { deck: opened.deck, base: String((await saved()).rev), slide: opened.slide } },
    { name: "added-frame.sse" },
  )
  await side.getByRole("textbox", { name: airaCopy.askAira }).fill("Add a panel")
  await page.keyboard.press("Enter")
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  const panel = [...(await saved()).nodes].find(([, node]) => (node as { name?: string }).name === "Panel")?.[0]
  if (panel === undefined) throw new Error("Aira added no Panel")
  await landNodes(stack, opened, [
    {
      id: "t:97",
      type: "shape",
      parent: panel,
      props: { box: spot(100, 100, 200, 100), geometry: { kind: "rect" }, fills: blue },
    },
  ])
  await expect(page.locator('[data-slide-box] [data-node="t:97"]')).toHaveCount(1)

  await side.getByRole("log").getByRole("button", { name: productCopy.undo, exact: true }).click()
  await expect(side.locator("[data-undo-stays]")).toHaveText(
    undoStaysNote(productCopy.agentName, { kept: [airaKeptLayerName("Panel")], left: [], waiting: [] }),
  )
  await expect(side.getByRole("log").getByRole("button", { name: productCopy.undo, exact: true })).toBeVisible()
  expect(((await savedNode(stack, opened, "t:97"))?.parent as { id: string }).id).toBe(panel)
})
