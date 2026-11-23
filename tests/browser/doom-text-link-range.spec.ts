import { expect } from "@playwright/test"
import { doomEditorCopy } from "../../apps/web/src/copy/doom-editor-copy"
import { linkCopy } from "../../apps/web/src/copy/link-copy"
import { test } from "./api-stack"
import { clickSlide, landNodes, openDoomEditor, savedNode } from "./doom-deck"
import { edit, layer, leave, runs, textOf } from "./text-layer"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a selected range of plain words shows an empty Link field and links only those words, leaving a layer link untouched", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  await page.getByRole("button", { name: doomEditorCopy.panelDesign, exact: true }).click()
  const withLayerLink = { ...layer("Read the site"), link: "https://layer.example/" }
  await landNodes(stack, opened, [{ id: "t:1", type: "shape", parent: opened.slide, props: withLayerLink }])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(3)

  await clickSlide(page, 300, 640)
  const address = page.locator(`[data-design-section="${linkCopy.section}"]`).getByRole("textbox")
  await expect(address).toHaveValue("https://layer.example/")

  await edit(page)
  await page.keyboard.press("Home")
  await expect(address).toHaveValue("https://layer.example/")
  for (let step = 0; step < 4; step++) await page.keyboard.press("Shift+ArrowRight")
  await expect(address).toHaveValue("")
  await expect(address).toHaveAttribute("placeholder", linkCopy.target)

  await address.fill("https://words.example/")
  await address.press("Enter")
  await expect(address).toHaveValue("https://words.example/")
  await leave(page)

  await expect
    .poll(async () => (await textOf(stack, opened))?.spans)
    .toEqual([{ end: 4, link: "https://words.example/" }, { end: 13 }])
  expect((await savedNode(stack, opened, "t:1"))?.link).toBe("https://layer.example/")
  await expect
    .poll(() =>
      runs(page)
        .first()
        .evaluate((node) => getComputedStyle(node).textDecorationLine),
    )
    .toBe("underline")
  expect(
    await runs(page)
      .nth(1)
      .evaluate((node) => getComputedStyle(node).textDecorationLine),
  ).toBe("none")
})
