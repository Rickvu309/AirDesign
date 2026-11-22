import path from "node:path"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { newBlankDeck } from "../bin/new-deck.mjs"
import { productCopy, readPictureToolCopy, shortcutCopy, transitionCopy, undoCopy } from "../bin/product-copy.mjs"

const shift = shortcutCopy.chord.other.shift
const exportName = shortcutCopy.gestures.export

const words = "Market context and sizing"
const part = "ppt/slides/slide1.xml"

export default async function drive({ repo, page, signIn, capture, note }) {
  const iconCopy = readPictureToolCopy()
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  await signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page
    .url()
    .split(/\/deck\//)
    .at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.locator("[data-design-mode]").click()
  const paint = page.locator("[data-slide-paint]")
  const slide = await paint.boundingBox()
  if (slide === null) throw new Error("no slide")
  const at = (x, y) => ({ x: slide.x + slide.width * x, y: slide.y + slide.height * y })
  const layer = (shape) => paint.locator(`[data-canvas-element="${part}#${shape}"]`)
  const frame = paint.locator("[data-selection]")

  await page.getByRole("button", { name: iconCopy.addIcon, exact: true }).click()
  await page.locator("[data-icon-tool]").getByRole("searchbox", { name: iconCopy.search }).fill("star")
  await page.locator("[data-icon-tool]").getByRole("button", { name: "star", exact: true }).click()
  await expect(layer(2)).toBeVisible()
  await page.keyboard.press("t")
  const spot = at(0.56, 0.48)
  await page.mouse.click(spot.x, spot.y)
  await page.keyboard.type(words)
  await page.keyboard.press("Escape")
  await page.keyboard.press("ControlOrMeta+KeyA")
  await page.keyboard.press("ControlOrMeta+KeyG")
  await expect(frame).toHaveAttribute("data-selection", "256.4")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.group, exact: true })).toBeVisible()
  const label = await layer(3).boundingBox()
  await expect
    .poll(async () => {
      const held = await frame.boundingBox()
      return (
        held !== null && label !== null && held.x <= label.x + 1 && held.x + held.width >= label.x + label.width - 1
      )
    })
    .toBe(true)
  await capture("grouped-right-after-typing")
  note(
    `A group made right after typing holds the label: label ${JSON.stringify(label)}, frame ${JSON.stringify(await frame.boundingBox())}`,
  )

  await page.keyboard.press("ControlOrMeta+KeyD")
  await expect(frame).toHaveAttribute("data-selection", "256.5")
  for (let step = 0; step < 8; step += 1) await page.keyboard.press("Shift+ArrowDown")
  await expect(layer(7)).toHaveText(words)
  await expect(layer(7)).toHaveAttribute("aria-label", words)
  await capture("group-copied")
  note("Ctrl+D copied the group with its label painted and named by its words")

  await page.keyboard.press("Escape")
  const icon = await layer(6).boundingBox()
  if (icon === null) throw new Error("no copied icon")
  await page.keyboard.down("Control")
  await page.mouse.click(icon.x + icon.width / 2, icon.y + icon.height / 2)
  await page.keyboard.up("Control")
  await expect(frame).toHaveAttribute("data-selection", "256.6")
  const drawn = () =>
    layer(6).evaluate((node) =>
      [node, ...node.querySelectorAll("*")]
        .map((each) => getComputedStyle(each).backgroundImage)
        .filter((image) => image !== "none")
        .join(" "),
    )
  const star = await drawn()
  const panel = page.locator("[data-design-element]")
  await panel.getByRole("searchbox", { name: iconCopy.search }).fill("heart")
  const picked = Date.now()
  await panel.getByRole("button", { name: "heart", exact: true }).click()
  await expect.poll(drawn, { timeout: 1000 }).not.toBe(star)
  await capture("grouped-icon-swapped")
  note(
    `The heart picked for the icon inside the copied group painted ${String(Date.now() - picked)} ms after the click`,
  )

  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  const sizeOf = (shape) =>
    layer(shape).evaluate((node) => getComputedStyle(node.querySelector("[data-run]") ?? node).fontSize)
  const before = [await sizeOf(3), await sizeOf(7)]
  for (const shape of [3, 7]) {
    const box = await layer(shape).boundingBox()
    if (box === null) throw new Error("no label")
    if (shape === 7) await page.keyboard.down(shift)
    await page.keyboard.down("Control")
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.keyboard.up("Control")
    if (shape === 7) await page.keyboard.up(shift)
  }
  await expect(page.locator("[data-layers-panel]").getByRole("treeitem", { name: words, selected: true })).toHaveCount(
    2,
  )
  await page.keyboard.press("ControlOrMeta+Shift+Period")
  await expect.poll(async () => [await sizeOf(3), await sizeOf(7)]).not.toEqual(before)
  const after = [await sizeOf(3), await sizeOf(7)]
  expect(after[0]).toBe(after[1])
  await capture("size-key-on-two-labels")
  note(`Ctrl+Shift+> on two selected labels in two groups: ${before.join(", ")} became ${after.join(", ")}`)
  await page.keyboard.press("ControlOrMeta+KeyZ")
  await expect.poll(async () => [await sizeOf(3), await sizeOf(7)]).toEqual(before)
  note("One Undo turned both labels back")
  await page.keyboard.press("ControlOrMeta+Shift+Period")
  await expect.poll(async () => [await sizeOf(3), await sizeOf(7)]).toEqual(after)

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: exportName, exact: true }).click()
  await expect(page.getByRole("dialog", { name: exportName }).getByRole("button", { name: exportName })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "group-text-copy.pptx")
  await (await downloading).saveAs(exported)
  const parts = await pptx.readParts(await readFile(exported))
  const xml = new TextDecoder().decode(parts.get(part))
  const groups = [...xml.matchAll(/<p:grpSpPr>.*?<a:off x="(\d+)" y="\d+"\/><a:ext cx="(\d+)"/gs)].map((match) =>
    Number(match[2]),
  )
  const labels = [...xml.matchAll(/<p:sp>.*?<\/p:sp>/gs)].filter((match) => match[0].includes(words))
  note(`The export's group widths ${JSON.stringify(groups)}; label shapes ${String(labels.length)}`)
  expect(labels).toHaveLength(2)
  for (const each of labels) expect(each[0]).toContain(`name="${words}"`)
  note("The export names both labels by their words")
}
