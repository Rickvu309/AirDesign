import { expect } from "@playwright/test"
import { test } from "./api-stack"
import { clickSlide, landNodes, openEditor, otherTab, savedNode, selectedIds, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

const blue = [{ kind: "solid", color: { var: "accent4" } }]

test("Ctrl+Z of the tab that grouped a layer, after the other tab nudged it, puts it back on the slide where the person sees it", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:81",
      type: "shape",
      parent: opened.slide,
      props: { box: spot(300, 300, 200, 100), geometry: { kind: "rect" }, fills: blue },
    },
  ])
  const boxOf = async () => (await savedNode(stack, opened, "t:81"))?.box as Box
  const parentOf = async () =>
    ((await savedNode(stack, opened, "t:81"))?.parent as { id: string } | null | undefined)?.id
  await expect(page.locator('[data-slide-box] [data-node="t:81"]')).toHaveCount(1)
  const other = await otherTab(context, stack, opened.deck)
  for (const tab of [page, other]) {
    await expect
      .poll(async () => {
        await clickSlide(tab, 400, 350)
        return selectedIds(tab)
      })
      .toEqual(["t:81"])
  }
  await other.keyboard.press("ControlOrMeta+g")
  await expect.poll(parentOf).not.toBe(opened.slide)
  const group = (await parentOf())!
  await expect(page.locator(`[data-node="${group}"] [data-node="t:81"]`).first()).toBeAttached()
  const grouped = await boxOf()
  const holder = (await savedNode(stack, opened, group))?.box as Box

  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await boxOf()).x).toBe(grouped.x + 1)
  await other.keyboard.press("ControlOrMeta+z")
  await expect.poll(parentOf).toBe(opened.slide)
  const seen = await boxOf()
  expect(seen).toMatchObject({ x: holder.x + grouped.x + 1, y: holder.y + grouped.y })

  await other.close()
})
