import { expect } from "@playwright/test"
import { borderCopy, borderWords } from "../../apps/web/src/copy/border-copy"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { fillWords } from "../../apps/web/src/copy/fill-copy"
import { test } from "./api-stack"
import { accent, clickSlide, landNodes, openEditor, spot } from "./editor-deck"
import { panel, pick, reloadDesign, saved, undoOnStage } from "./editor-design"

function borderWord(key: "arrow" | "triangle"): string {
  const word = borderWords[key]
  if (word === undefined) throw new Error(key)
  return word
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a person sets a line's start and end arrowheads, and a rectangle has neither", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await expect(panel(page)).toBeVisible()
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: {
        name: "Rule",
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
    {
      id: "t:2",
      type: "shape",
      parent: opened.slide,
      props: { box: spot(1000, 200, 300, 200), geometry: { kind: "rect" }, fills: accent },
    },
  ])
  const arrowsOf = () => saved(stack, opened, "t:1").then((node) => node.geometry.arrows)
  await pick(page, "t:1", 400, 300)
  const end = panel(page).getByRole("combobox", { name: borderCopy["End arrow"], exact: true })
  const start = panel(page).getByRole("combobox", { name: borderCopy["Start arrow"], exact: true })
  await expect(end).toContainText(borderWord("arrow"))
  await expect(start).toContainText(fillWords.none)
  await end.click()
  await page.getByRole("option", { name: borderWord("triangle"), exact: true }).click()
  await expect.poll(arrowsOf).toEqual(["none", "triangle"])
  await start.click()
  await page.getByRole("option", { name: fillWords.circle, exact: true }).click()
  await expect.poll(arrowsOf).toEqual(["circle", "triangle"])

  await undoOnStage(page)
  await expect.poll(arrowsOf).toEqual(["none", "triangle"])
  await pick(page, "t:1", 400, 300)
  await start.click()
  await page.getByRole("option", { name: fillWords.circle, exact: true }).click()
  await expect.poll(arrowsOf).toEqual(["circle", "triangle"])
  await reloadDesign(page)
  await pick(page, "t:1", 400, 300)
  await expect(panel(page).getByRole("combobox", { name: borderCopy["Start arrow"], exact: true })).toContainText(
    fillWords.circle,
  )
  await expect(panel(page).getByRole("combobox", { name: borderCopy["End arrow"], exact: true })).toContainText(
    borderWord("triangle"),
  )
  await expect.poll(arrowsOf).toEqual(["circle", "triangle"])

  await clickSlide(page, 1150, 300)
  await expect(panel(page).getByRole("combobox", { name: borderCopy["Start arrow"], exact: true })).toHaveCount(0)
  await expect(panel(page).getByRole("combobox", { name: borderCopy["End arrow"], exact: true })).toHaveCount(0)
})
