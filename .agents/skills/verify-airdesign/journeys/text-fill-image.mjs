import path from "node:path"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { fillCopy, fillWords, transitionCopy } from "../bin/product-copy.mjs"

const undo = process.platform === "darwin" ? "Meta+z" : "Control+z"

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const { cookie } = await signIn()
  const fixture = path.join(repo, "scripts/pptx-fixtures/clean.pptx")
  const original = await pptx.readParts(await readFile(fixture))
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const element = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  const run = element.locator("[data-run]").first()
  const panel = page.locator("[data-design-element]")
  const segments = () => panel.getByRole("group", { name: fillCopy.text, exact: true })
  const pictured = async () => (await run.evaluate((node) => getComputedStyle(node).backgroundImage)).includes("url(")
  await element.click({ position: { x: 4, y: 4 } })
  await expect(segments().getByRole("button")).toHaveCount(3)
  expect(await pictured()).toBe(false)
  await segments().getByRole("button", { name: fillWords.image, exact: true }).click()
  await expect.poll(pictured).toBe(true)
  await expect(run).toHaveCSS("background-clip", "text")
  await capture("text-filled-with-image")
  note("Text fill shows three segments; choosing the image one paints the star icon clipped to the letters")

  await page.keyboard.press("Escape")
  await page.keyboard.press(undo)
  await expect.poll(pictured).toBe(false)
  note("One undo puts the letters back to their colour")
  await capture("text-fill-undone")

  await element.click({ position: { x: 4, y: 4 } })
  await segments().getByRole("button", { name: fillWords.image, exact: true }).click()
  await expect.poll(pictured).toBe(true)
  const server = async () => JSON.stringify((await post(deckRoutes.open, { deck }, cookie)).json.register)
  await expect.poll(server).toContain('\\"fill\\":{\\"image\\":\\"star\\"}')
  note("The server holds the run's fill as { image: star }")

  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await expect.poll(pictured).toBe(true)
  await element.click({ position: { x: 4, y: 4 } })
  await expect(segments().getByRole("button", { name: fillWords.image, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await capture("text-fill-image-reloaded")
  note("After a reload the letters still show the image and the panel has the image segment pressed")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export", exact: true }).click()
  const exported = path.join(path.dirname(await capture("text-fill-image-export")), "text-fill-image.pptx")
  await (await downloading).saveAs(exported)
  const parts = await pptx.readParts(await readFile(exported))
  const slide = new TextDecoder().decode(parts.get("ppt/slides/slide1.xml"))
  const filled = /<a:rPr[^>]*><a:blipFill rotWithShape="1"><a:blip[^>]* r:embed="(rId\d+)"/.exec(slide)
  expect(filled).not.toBeNull()
  const rels = new TextDecoder().decode(parts.get("ppt/slides/_rels/slide1.xml.rels"))
  const target = new RegExp(`Id="${filled[1]}"[^>]*Target="\\.\\./(media/[^"]+)"`).exec(rels)?.[1]
  expect(parts.has(`ppt/${target}`)).toBe(true)
  const changed = new Set(["ppt/slides/slide1.xml", "ppt/slides/_rels/slide1.xml.rels", "[Content_Types].xml"])
  for (const [name, bytes] of original) if (!changed.has(name)) expect(parts.get(name)).toEqual(bytes)
  note(
    `Export writes the run's native a:blipFill linked to ppt/${target}; every part but the slide, its relationships and the content types is byte-identical`,
  )
}
