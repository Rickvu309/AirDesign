import { undoCopy } from "../bin/product-copy.mjs"
import path from "node:path"
import { expect } from "@playwright/test"

const first = "ppt/slides/slide1.xml"
const second = "ppt/slides/slide2.xml"

function pastes(register) {
  return (register?.order ?? [])
    .filter((command) => command.slide === "element-clone")
    .map((command) => [command.id, command.source, command.element.node])
}

function gone(register) {
  return (register?.order ?? []).filter((command) => command.slide === "element-remove").map((command) => command.node)
}

export default async function drive({ repo, page, context, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto(".")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/sections-before.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = new URL(page.url()).pathname.replace(/^\/deck\//, "")
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const shape = (part, number) => page.locator(`[data-slide-paint] [data-canvas-element="${part}#${number}"]`)
  const placed = (locator) =>
    locator.evaluate((frame) =>
      [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) => Number.parseFloat(each)),
    )
  const chosen = page.locator("[data-slide-paint] [data-selection]")
  const server = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register
  const entry = (number) => page.locator(`[data-slide-entry="${number}"]`)
  const at = await placed(shape(first, 2))
  note(`imported sections-before.pptx as deck ${deck}; slide 1's rectangle "Hello" sits at x ${at[0]}, y ${at[1]} px`)

  await shape(first, 2).click()
  await expect(chosen).toHaveAttribute("data-selection", "256.2")
  await page.keyboard.press("ControlOrMeta+KeyC")
  await entry(2).click()
  await expect(entry(2)).toHaveAttribute("aria-current", "true")
  await page.locator("[data-slide-paint]").focus()
  await page.keyboard.press("ControlOrMeta+KeyV")
  await expect(shape(second, 9)).toBeVisible()
  expect(await placed(shape(second, 9))).toEqual(at)
  await expect(chosen).toHaveAttribute("data-selection", "257.9")
  await capture("pasted-other-slide")
  note("Ctrl+C on the rectangle, then Ctrl+V on slide 2, paints 257.9 at the rectangle's own place and selects it")

  await shape(second, 7).click()
  const [left, top] = await placed(shape(second, 7))
  await page.keyboard.press("ControlOrMeta+Shift+KeyV")
  await expect(shape(second, 10)).toBeVisible()
  expect((await placed(shape(second, 10))).slice(0, 2)).toEqual([left, top])
  await expect(chosen).toHaveAttribute("data-selection", "257.10")
  await capture("pasted-over-selection")
  note(`Ctrl+Shift+V with the text "2600" selected pastes 257.10 with its top left on the text's, ${left},${top}`)
  await expect
    .poll(async () => pastes(await server()), { timeout: 20_000 })
    .toEqual([
      ["257", "256.2", "257.9"],
      ["257", "256.2", "257.10"],
    ])
  note("the server keeps two element-clone rows onto slide 257, both from 256.2")

  await page.keyboard.press("ControlOrMeta+KeyX")
  await expect(shape(second, 10)).toHaveCount(0)
  await expect.poll(async () => gone(await server()), { timeout: 20_000 }).toEqual(["257.10"])
  await capture("cut")
  note("Ctrl+X cuts 257.10; the server removes it")
  await page.getByRole("button", { name: undoCopy.undoNamed["cut-layer"], exact: true }).click()
  await expect(shape(second, 10)).toBeVisible()
  await page.getByRole("button", { name: undoCopy.undoNamed["paste-layer"], exact: true }).click()
  await expect(shape(second, 10)).toHaveCount(0)
  await expect(shape(second, 9)).toBeVisible()
  await capture("paste-undone")
  note("Undo cut brings 257.10 back, and one Undo paste takes it away again; 257.9 stays")

  const replaced = shape(second, 5)
  const [x, y] = await placed(replaced)
  await replaced.click()
  await page.keyboard.press("ControlOrMeta+Shift+KeyR")
  await expect(replaced).toHaveCount(0)
  await expect(shape(second, 11)).toBeVisible()
  expect((await placed(shape(second, 11))).slice(0, 2)).toEqual([x, y])
  await capture("pasted-to-replace")
  note(
    `Ctrl+Shift+R with the text "2400" selected removes it and pastes 257.11 with its top left on the text's, ${x}, ${y}`,
  )
  await page.getByRole("button", { name: undoCopy.undoNamed["replace-layer"], exact: true }).click()
  await expect(replaced).toBeVisible()
  await expect(shape(second, 11)).toHaveCount(0)
  note("one Undo paste to replace brings the text back and takes the copy away")

  await page.goto(".")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/picture-png.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const pictures = new URL(page.url()).pathname.replace(/^\/deck\//, "")
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", pictures)
  await shape(first, 4).click()
  await page.keyboard.press("ControlOrMeta+KeyC")
  await page.goto(".")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page).not.toHaveURL(new RegExp(pictures))
  const clean = new URL(page.url()).pathname.replace(/^\/deck\//, "")
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", clean)
  await page.locator("[data-slide-paint]").focus()
  await page.keyboard.press("ControlOrMeta+KeyV")
  await expect(shape(first, 3)).toBeVisible()
  await capture("pasted-other-deck")
  const added = async () =>
    ((await post(deckRoutes.open, { deck: clean }, cookie)).json.register?.order ?? [])
      .filter((command) => command.slide === "element-add" && command.pasted !== undefined)
      .map((command) => [command.element.node, command.pasted.media.length])
  await expect.poll(added, { timeout: 20_000 }).toEqual([["256.3", 1]])
  note(
    "the picture copied in picture-png.pptx pastes into clean.pptx as 256.3, an element-add carrying its markup and one image",
  )
}
