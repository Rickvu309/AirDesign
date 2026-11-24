import { expect, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { doomEditorCopy } from "../../apps/web/src/copy/editor-copy"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { test } from "./api-stack"
import { clickSlide, landNodes, openDoomEditor, savedNode, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const section = (page: Page, title: string) => page.locator(`[data-design-panel] [data-design-section="${title}"]`)
const unheld = [fillWords.scaled!, fillWords.rotateWithShape!, fillWords.kind!, fillWords.l!]

async function showsOnlyWhatDoomKeeps(page: Page, title: string) {
  const shown = section(page, title)
  await expect(shown.getByText(fillWords.shade!, { exact: true })).toBeVisible()
  for (const word of unheld) await expect(shown.getByText(word, { exact: true })).toHaveCount(0)
}

test("a gradient on a shape and the slide background shows only stops, direction and angle, and From center saves a radial one", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  await page.getByRole("button", { name: doomEditorCopy.panelDesign, exact: true }).click()
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(200, 200, 400, 300),
        geometry: { kind: "rect" },
        fills: [
          {
            kind: "gradient",
            shape: "linear",
            angle: 90,
            stops: [
              { at: 0, color: { var: "accent1" } },
              { at: 1, color: { var: "background" } },
            ],
          },
        ],
      },
    },
  ])
  const saved = async (id: string) => (await savedNode(stack, opened, id)) as Record<string, any>
  await expect(page.locator('[data-slide-box] [data-node="t:1"]')).toBeVisible()

  await clickSlide(page, 400, 350)
  await showsOnlyWhatDoomKeeps(page, fillCopy.section)
  await section(page, fillCopy.section).getByRole("button", { name: fillWords.path!, exact: true }).click()
  await expect.poll(async () => (await saved("t:1")).fills[0].shape).toBe("radial")
  await showsOnlyWhatDoomKeeps(page, fillCopy.section)

  await page.locator("[data-doom-stage]").click({ position: { x: 20, y: 20 } })
  await section(page, designCopy.background).getByRole("button", { name: fillWords.gradient, exact: true }).click()
  await expect.poll(async () => (await saved(opened.slide)).fills?.[0]?.kind).toBe("gradient")
  await showsOnlyWhatDoomKeeps(page, designCopy.background)
})
