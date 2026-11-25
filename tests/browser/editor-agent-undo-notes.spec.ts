import { expect } from "@playwright/test"
import { airaCopy, airaKeptLayerName } from "../../apps/web/src/copy/aira-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import * as doom from "../../packages/doom/src/index.ts"
import { test } from "./api-stack"
import { landNodes, openEditor, savedNode, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const blue = [{ kind: "solid", color: { var: "accent4" } }]
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
