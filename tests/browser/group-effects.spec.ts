import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { openDeck, settled } from "./design-panel"
import { partsOf } from "./shape-fills"

const deck = "doe-heat-pumps.pptx"
const part = "ppt/slides/slide8.xml"
const group = `${part}#18`
const held = [7, 9, 10, 15].map((shape) => `${part}#${String(shape)}`)
const groupList =
  /<p:grpSpPr><a:xfrm>.*?<\/a:xfrm><a:effectLst><a:glow rad="63500">.*?<\/a:glow><a:outerShdw .*?<\/a:outerShdw><a:softEdge rad="63500"\/><\/a:effectLst><\/p:grpSpPr>/

test.use({ viewport: { width: 1600, height: 1000 } })

function layer(page: Page): Locator {
  return page.locator(`[data-slide-paint] [data-group-effects="${group}"]`)
}

function painted(page: Page): Promise<{ readonly members: readonly string[]; readonly steps: readonly string[] }> {
  return layer(page).evaluate((node) => {
    const id = /#([^")]+)/.exec(getComputedStyle(node).filter)?.[1] ?? ""
    const filter = document.getElementById(id)
    return {
      members: [...node.querySelectorAll("[data-canvas-element]")].map(
        (each) => each.getAttribute("data-canvas-element") ?? "",
      ),
      steps: [...(filter?.children ?? [])].map((step) => step.getAttribute("result") ?? step.tagName),
    }
  })
}

function choices(section: Locator, label: string): Locator {
  return section.getByRole("group", { name: label, exact: true }).first()
}

async function slide(page: Page): Promise<void> {
  const entry = page.locator('[data-slide-entry="8"]')
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
}

async function effectsOfGroup(page: Page): Promise<Locator> {
  const design = page.getByRole("button", { name: "Design", exact: true })
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  await page.locator(`[data-slide-paint] [data-canvas-element="${held[0]!}"]`).click({ force: true })
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", /\.18$/)
  const effects = page
    .locator("[data-design-element] section")
    .filter({ has: page.getByRole("heading", { name: "Effects", exact: true }) })
  await expect(effects).toBeVisible()
  return effects
}

test("a person gives a file group a shadow, a glow and a soft edge, and the canvas paints them once over everything the group holds, through Undo, a reload, the export and a new import @export", async ({
  page,
}, testInfo) => {
  await openDeck(page, deck)
  await slide(page)
  await expect(page.locator(`[data-slide-paint] [data-canvas-element="${group}"]`)).toHaveCount(1)
  await expect(layer(page)).toHaveCount(0)
  const effects = await effectsOfGroup(page)
  await choices(effects, "Shadow").getByRole("button", { name: "Outer", exact: true }).click()
  await expect.poll(async () => (await painted(page)).members).toEqual(held)
  await choices(effects, "Glow").getByRole("button", { name: "Glow", exact: true }).click()
  await choices(effects, "Soft edge").getByRole("button", { name: "Radius", exact: true }).click()
  await expect
    .poll(async () => (await painted(page)).steps)
    .toEqual([
      "worn",
      "edge",
      "soft",
      "shade",
      "cast",
      "shadow-color",
      "shadow-shape",
      "shadow",
      "grown",
      "halo",
      "glow-color",
      "glow-shape",
      "glow",
      "feMerge",
    ])
  await page.locator("[data-slide-paint]").screenshot({ path: testInfo.outputPath("group-effects.png") })

  for (let step = 0; step < 3; step += 1) await page.getByRole("button", { name: "Undo effects", exact: true }).click()
  await expect(layer(page)).toHaveCount(0)
  for (let step = 0; step < 3; step += 1) await page.getByRole("button", { name: "Redo effects", exact: true }).click()
  await expect.poll(async () => (await painted(page)).steps.length).toBe(14)

  await page.reload()
  await settled(page)
  await slide(page)
  await expect.poll(async () => (await painted(page)).members).toEqual(held)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("exported-group-effects.pptx")
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures", deck))
  const saved = await partsOf(file)
  expect(saved.get(part)?.toString("utf8")).toMatch(groupList)
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([part])

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await slide(page)
  await expect.poll(async () => (await painted(page)).members).toEqual(held)
})
