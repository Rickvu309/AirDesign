import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { openDeck, settled, typeColor } from "./design-panel"
import { partsOf } from "./shape-fills"

const exportName = "exported-theme.pptx"
const judged = join(process.cwd(), "tests/browser", exportName)
const themes = ["ppt/theme/theme1.xml", "ppt/theme/theme2.xml"]
const red = "c00000"

test.use({ viewport: { width: 1600, height: 1000 } })

async function themePanel(page: Page): Promise<Locator> {
  const design = page.getByRole("button", { name: "Design", exact: true })
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  const theme = page.locator("[data-design-theme]")
  await expect(theme).toBeVisible()
  return theme
}

function entry(page: Page, number: number): Locator {
  return page.locator(`[data-slide-entry="${String(number)}"]`)
}

function painted(page: Page, element: string): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${element}"]`)
}

function fonts(element: Locator): Promise<string> {
  return element.evaluate((node) =>
    [...node.querySelectorAll<HTMLElement>("*")].map((each) => each.style.fontFamily).join(" | "),
  )
}

test("a person changes accent 1 and the heading font of a deck with two themes, every slide that names them repaints, and the theme survives Undo, a reload, the export and a new import @export", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  await rm(judged, { force: true })
  await openDeck(page, "doe-heat-pumps.pptx")
  let theme = await themePanel(page)
  await entry(page, 8).click()
  const oval = painted(page, "ppt/slides/slide8.xml#7")
  await expect(oval).toBeVisible()
  const ovalBefore = await oval.innerHTML()
  await typeColor(page, theme.getByRole("button", { name: "Accent 1", exact: true }), `#${red}`)
  await expect.poll(() => oval.innerHTML()).not.toBe(ovalBefore)
  await expect(theme.getByRole("button", { name: "Accent 1", exact: true })).toHaveAttribute(
    "title",
    new RegExp(`#${red}`, "i"),
  )

  await entry(page, 1).click()
  const title = painted(page, "ppt/slides/slide1.xml#2")
  await expect.poll(() => fonts(title)).toContain("Calibri Light")
  const heading = theme.getByRole("textbox", { name: "Heading font", exact: true })
  await expect(heading).toHaveValue("Calibri Light")
  await heading.fill("Georgia")
  await heading.press("Enter")
  await expect.poll(() => fonts(title)).toContain("Georgia")
  await page.getByRole("button", { name: "Undo theme font", exact: true }).click()
  await expect.poll(() => fonts(title)).not.toContain("Georgia")
  await expect(heading).toHaveValue("Calibri Light")
  await page.getByRole("button", { name: "Redo theme font", exact: true }).click()
  await expect.poll(() => fonts(title)).toContain("Georgia")

  await page.reload()
  await settled(page)
  theme = await themePanel(page)
  await expect(theme.getByRole("textbox", { name: "Heading font", exact: true })).toHaveValue("Georgia")
  await expect(theme.getByRole("button", { name: "Accent 1", exact: true })).toHaveAttribute(
    "title",
    new RegExp(`#${red}`, "i"),
  )
  await expect.poll(() => fonts(painted(page, "ppt/slides/slide1.xml#2"))).toContain("Georgia")

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(exportName)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx"))
  const saved = await partsOf(file)
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name).sort()).toEqual(themes)
  for (const part of themes) {
    const xml = saved.get(part)?.toString("utf8") ?? ""
    expect(xml).toContain('<a:accent1><a:srgbClr val="C00000"/></a:accent1>')
    expect(xml).toContain('<a:majorFont><a:latin typeface="Georgia"/>')
  }
  await copyFile(file, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  theme = await themePanel(page)
  await expect(theme.getByRole("textbox", { name: "Heading font", exact: true })).toHaveValue("Georgia")
  await expect(theme.getByRole("button", { name: "Accent 1", exact: true })).toHaveAttribute(
    "title",
    new RegExp(`#${red}`, "i"),
  )
})
