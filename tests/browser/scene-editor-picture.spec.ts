import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { test, signInBrowser, forward } from "./api-stack"
import { openSceneEditor, savedNode, serveOriginals, slidePoint } from "./scene-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const pictureFile = join(process.cwd(), "scripts/pptx-fixtures/picture.png")

type Sent = "drop" | "paste"

async function send(
  page: Page,
  how: Sent,
  name: string,
  type: string,
  bytes: readonly number[],
  at?: { x: number; y: number },
) {
  await page.evaluate(
    ([how, name, type, bytes, at]) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([new Uint8Array(bytes)], name, { type }))
      const target = document.querySelector("[data-scene-stage]")!
      if (how === "drop")
        target.dispatchEvent(
          new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
            clientX: at?.x ?? 0,
            clientY: at?.y ?? 0,
          }),
        )
      else
        target.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }))
    },
    [how, name, type, bytes, at] as const,
  )
}

const pictures = (page: Page) => page.locator('[data-slide-box] [data-paint="image"]')
const pictureNode = (page: Page) =>
  page.locator("[data-slide-box] [data-node]").filter({ has: page.locator('[data-paint="image"]') })

test("a picture file dropped on the canvas lands at the drop point at its own ratio, paints at once, undoes, and shows again after a reload and on a fresh device", async ({
  page,
  context,
  browser,
  stack,
}) => {
  await serveOriginals(page, stack.originals)
  const opened = await openSceneEditor(page, context, stack)
  const bytes = [...(await readFile(pictureFile))]
  const at = await slidePoint(page, 600, 300)
  await send(page, "drop", "picture.png", "image/png", bytes, at)
  await expect(pictures(page)).toHaveCount(1)
  await expect
    .poll(async () => pictures(page).evaluate((node) => getComputedStyle(node).backgroundImage))
    .toContain("blob:")
  const picture = pictureNode(page)
  const shown = await picture.boundingBox()
  const slide = await page.locator("[data-slide-box]").boundingBox()
  if (shown === null || slide === null) throw new Error("no boxes")
  expect(shown.width / shown.height).toBeCloseTo(1.5, 1)
  expect(shown.x + shown.width / 2).toBeCloseTo(at.x, -1)
  expect(shown.y + shown.height / 2).toBeCloseTo(at.y, -1)

  const id = await picture.getAttribute("data-node")
  await expect
    .poll(
      async () => ((await savedNode(stack, opened, id ?? ""))?.fills as { asset: string }[] | undefined)?.[0]?.asset,
    )
    .toMatch(/^[0-9a-f]{64}$/)
  const asset = ((await savedNode(stack, opened, id ?? ""))?.fills as { asset: string }[])[0]!.asset
  await expect
    .poll(async () => (await stack.post("/decks/media", { deck: opened.deck, sha256: asset }, opened.cookie)).json.ok)
    .toBe(true)

  await page.keyboard.press("ControlOrMeta+z")
  await expect(pictures(page)).toHaveCount(0)
  await expect.poll(async () => (await savedNode(stack, opened, id ?? ""))?.parent).toBeNull()
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(pictures(page)).toHaveCount(1)
  await expect.poll(async () => (await savedNode(stack, opened, id ?? ""))?.parent).toMatchObject({ id: opened.slide })

  await page.reload()
  await page.locator("[data-scene-ready]").waitFor()
  await expect(pictures(page)).toHaveCount(1)
  await expect
    .poll(async () => pictures(page).evaluate((node) => getComputedStyle(node).backgroundImage))
    .toContain("blob:")

  const fresh = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const other = await fresh.newPage()
  await signInBrowser(fresh, opened.cookie)
  await forward(other, stack)
  await serveOriginals(other, stack.originals)
  await other.goto(`/s/${opened.deck}`)
  await other.locator("[data-scene-ready]").waitFor()
  await expect(pictures(other)).toHaveCount(1)
  await expect
    .poll(async () => pictures(other).evaluate((node) => getComputedStyle(node).backgroundImage))
    .toContain("blob:")
  await fresh.close()
})

test("a picture pasted from the clipboard lands centred, and a file that is not a picture lands nothing", async ({
  page,
  context,
  stack,
}) => {
  await serveOriginals(page, stack.originals)
  await openSceneEditor(page, context, stack)
  await send(page, "paste", "notes.txt", "text/plain", [104, 105])
  await send(page, "drop", "notes.txt", "text/plain", [104, 105], { x: 400, y: 400 })
  await expect(pictures(page)).toHaveCount(0)
  await send(page, "paste", "picture.png", "image/png", [...(await readFile(pictureFile))])
  await expect(pictures(page)).toHaveCount(1)
  const shown = await pictureNode(page).boundingBox()
  const slide = await page.locator("[data-slide-box]").boundingBox()
  if (shown === null || slide === null) throw new Error("no boxes")
  expect(shown.x + shown.width / 2).toBeCloseTo(slide.x + slide.width / 2, -1)
  expect(shown.y + shown.height / 2).toBeCloseTo(slide.y + slide.height / 2, -1)
})

test("a dropped picture paints and lands in the deck while its upload is failing, and the upload goes through when the device is back online", async ({
  page,
  context,
  stack,
}) => {
  await serveOriginals(page, stack.originals)
  let offline = true
  await page.route(
    (url) => url.hostname === "original.test",
    async (route) => {
      if (offline && route.request().method() !== "OPTIONS") await route.abort()
      else await route.fallback()
    },
  )
  const opened = await openSceneEditor(page, context, stack)
  await send(page, "drop", "picture.png", "image/png", [...(await readFile(pictureFile))], { x: 800, y: 500 })
  await expect
    .poll(async () => pictures(page).evaluate((node) => getComputedStyle(node).backgroundImage))
    .toContain("blob:")
  const id = (await pictureNode(page).getAttribute("data-node")) ?? ""
  await expect.poll(async () => (await savedNode(stack, opened, id))?.parent).toMatchObject({ id: opened.slide })
  const asset = ((await savedNode(stack, opened, id))?.fills as { asset: string }[])[0]!.asset
  const stored = async () =>
    (await stack.post("/decks/media", { deck: opened.deck, sha256: asset }, opened.cookie)).json.ok
  expect(await stored()).toBe(false)
  offline = false
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  await expect.poll(stored).toBe(true)
})
