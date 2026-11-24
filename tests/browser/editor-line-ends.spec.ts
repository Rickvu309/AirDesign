import { expect, type Page } from "@playwright/test"
import { borderWords } from "../../apps/web/src/copy/border-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { accent, clickSlide, landNodes, openEditor, savedNode, slidePoint, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Line = { start: unknown; end: unknown; route: string }

async function gripCentre(page: Page, grip: string) {
  const box = await page.locator(`[data-grip="${grip}"]`).boundingBox()
  if (box === null) throw new Error(`no ${grip}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

test("a line's end drags onto a shape's side and stays there, frees again, and the panel changes its route", async ({
  page,
  context,
  stack,
}) => {
  covers("line-end")
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(1000, 500, 300, 200), fills: accent } },
    {
      id: "t:2",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(200, 300, 400, 0),
        strokes: accent,
        stroke: { weight: 4, align: "center", dash: "solid" },
        geometry: {
          kind: "line",
          start: { x: 200, y: 300 },
          end: { x: 600, y: 300 },
          route: "straight",
          arrows: ["none", "arrow"],
        },
      },
    },
  ])
  const line = async () => (await savedNode(stack, opened, "t:2"))?.geometry as Line
  await clickSlide(page, 400, 300)
  await expect(page.locator('[data-grip="line-end"]')).toBeVisible()

  await dragTo(page, await gripCentre(page, "line-end"), await slidePoint(page, 1004, 602))
  await expect.poll(async () => (await line()).end).toEqual({ node: "t:1", site: "l" })
  await expect(page.locator('[data-line-end="attached"]')).toHaveCount(1)

  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  const border = page.locator(`[data-design-panel] [data-design-section="${designCopy.border}"]`)
  await border.getByRole("button", { name: borderWords["route.elbow"]!, exact: true }).click()
  await expect.poll(async () => (await line()).route).toBe("elbow")

  await dragTo(page, await gripCentre(page, "line-end"), await slidePoint(page, 700, 150))
  await expect.poll(async () => (await line()).end).toEqual({ x: 700, y: 150 })

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await line()).end).toEqual({ node: "t:1", site: "l" })
})
