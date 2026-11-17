import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

export default async function drive(kit) {
  const { page, repo, expect, capture, post, deckRoutes } = kit
  const require = createRequire(import.meta.url)
  const { geometryCopy } = require(path.join(repo, "apps/web/src/copy/geometry-copy.ts"))
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const { cookie } = await kit.signIn()
  for (const file of ["shapes-added", "picture-png"]) {
    await page.goto("/")
    await page.locator("input[type=file]").setInputFiles(path.join(repo, `scripts/pptx-fixtures/${file}.pptx`))
    await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
    const deck = page.url().split("/").at(-1)
    await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
    await page.getByRole("button", { name: "Design", exact: true }).click()
    const shape = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    await shape.click({ position: { x: 8, y: 8 } })
    const panel = page.locator("[data-design-element]")
    const corners = panel.getByRole("textbox", { name: geometryCopy.corners, exact: true })
    await expect(corners).toHaveValue("0")
    await capture(`${file}-square`)
    await corners.fill("20.5")
    await corners.press("Enter")
    await expect(corners).toHaveValue("20.5")
    const at = { part: "ppt/slides/slide1.xml", shape: "4" }
    const original = await pptx.readParts(await readFile(path.join(repo, `scripts/pptx-fixtures/${file}.pptx`)))
    const box = pptx
      .paintReader(original)
      .slide(at.part)
      .elements.find((each) => each.shape === at.shape).box
    const adj = Math.round(((20.5 * 9525) / Math.min(box.width, box.height)) * 100000)
    await expect
      .poll(async () => JSON.stringify((await post(deckRoutes.open, { deck }, cookie)).json.register))
      .toContain(`"adj":${adj}`)
    await capture(`${file}-rounded`)
    await page.reload()
    await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
    await shape.click({ position: { x: 30, y: 30 } })
    await expect(corners).toHaveValue("20.5")
    const downloading = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export", exact: true }).click()
    await page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export", exact: true }).click()
    const exported = path.join(path.dirname(await capture(`${file}-export`)), `${file}-corners.pptx`)
    await (await downloading).saveAs(exported)
    const parts = await pptx.readParts(await readFile(exported))
    expect(pptx.shownGeometry(parts, at)?.value).toEqual({ preset: "roundRect", adjust: { adj } })
    for (const [name, bytes] of original) if (name !== at.part) expect(parts.get(name)).toEqual(bytes)
    await shape.click({ position: { x: 30, y: 30 } })
    await corners.fill("0")
    await corners.press("Enter")
    await expect(corners).toHaveValue("0")
    await expect
      .poll(async () => JSON.stringify((await post(deckRoutes.open, { deck }, cookie)).json.register))
      .toContain('"preset":"rect"')
    kit.note(
      `${file}: radius 20.5 px saved, reloaded and exported as native roundRect adj ${adj}; all other parts byte-identical; zero restores rect`,
    )
  }
}
