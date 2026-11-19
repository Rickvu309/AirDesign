import { productCopy } from "../bin/product-copy.mjs"
import { createRequire } from "node:module"
import path from "node:path"
import { expect } from "@playwright/test"

const node = "256.2"
const element = "ppt/slides/slide1.xml#2"
const emuPerPixel = 15_240
const kept = { x: 1_041_400, y: 1_371_600, cx: 3_657_600, cy: 2_743_200 }

function lastBox(register) {
  const rows = register?.elements?.[node]?.landed ?? []
  return rows.filter((row) => row.visible && row.property === "box").at(-1)?.value ?? null
}

async function forgetLocalRows(page) {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction("rows", "readwrite")
          transaction.onerror = () => reject(transaction.error)
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          const cursor = transaction.objectStore("rows").openCursor()
          cursor.onsuccess = () => {
            const at = cursor.result
            if (at === null) return
            const row = at.value
            if (typeof row === "object" && row !== null && "kind" in row) at.delete()
            at.continue()
          }
        }
      }),
  )
}

async function placed(page) {
  return page
    .locator(`[data-canvas-element="${element}"]`)
    .evaluate((frame) =>
      [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) => Number.parseFloat(each)),
    )
}

async function drag(page, from, by) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 })
  await page.mouse.up()
}

async function slideXml(repo, file) {
  const zip = createRequire(path.join(repo, "packages/pptx/package.json"))("@zip.js/zip.js")
  const { readFile } = await import("node:fs/promises")
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((each) => each.filename === "ppt/slides/slide1.xml")
  const text = await entry.getData(new zip.TextWriter())
  await reader.close()
  return text
}

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  await page.goto("/")
  await expect(page.getByRole("button", { name: productCopy.newDeck, exact: true })).toBeVisible()
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  const text = page.locator('[contenteditable="true"]')
  await expect(text).toHaveText("Hello")
  note(`imported clean.pptx as deck ${deck}; the text box sits at 30,30 and is 360 by 120 px on the 800 px slide`)
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  const origin = { x: Math.round(slide.x), y: Math.round(slide.y) }
  await text.click()
  await expect(text).toBeFocused()
  await expect(page.locator("[data-selection]")).toHaveCount(1)
  await expect(page.locator("[data-grip]:not([data-grip=move])")).toHaveCount(4)
  await capture("selected")
  note("a click in the text puts the caret there and shows the selection frame with four corner handles")
  await drag(page, { x: origin.x + 300, y: origin.y + 150 }, { x: 30, y: 60 })
  expect(await placed(page)).toEqual([60, 90, 360, 120])
  await capture("moved")
  note("dragging the frame's bottom edge by 30,60 px moved the box to 60,90")
  await drag(page, { x: origin.x + 420, y: origin.y + 210 }, { x: -120, y: 60 })
  expect(await placed(page)).toEqual([60, 90, 240, 180])
  await capture("resized")
  note("dragging the bottom-right handle by -120,60 px resized the box to 240 by 180 with its top-left corner kept")
  await expect(page.getByRole("group", { name: "Hello" })).toBeFocused()
  await page.keyboard.press("Shift+ArrowRight")
  await expect.poll(async () => (await placed(page))[0]).toBeCloseTo(kept.x / emuPerPixel, 3)
  await capture("nudged")
  note("Shift+ArrowRight nudged the selected box 10 pt to the right")
  await expect
    .poll(async () => lastBox((await post(deckRoutes.open, { deck }, cookie)).json.register), { timeout: 20_000 })
    .toEqual(kept)
  note(`server copy of ${deck} keeps the box ${JSON.stringify(kept)} as its last box row (${deckRoutes.open.path})`)
  const deckUrl = page.url()
  await page.goto("/version")
  await forgetLocalRows(page)
  await page.goto(deckUrl)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello", { timeout: 20_000 })
  await expect
    .poll(
      async () => {
        const shown = await placed(page)
        return [kept.x, kept.y, kept.cx, kept.cy].every(
          (emu, index) => Math.abs((shown[index] ?? Number.NaN) - emu / emuPerPixel) < 5e-4,
        )
      },
      { timeout: 20_000 },
    )
    .toBe(true)
  await capture("reloaded-from-server")
  note("with every local edit row gone, reopening the deck paints the box where the server keeps it")
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const xml = await slideXml(repo, await (await saving).path())
  const frame = `<a:xfrm><a:off x="${kept.x}" y="${kept.y}"/><a:ext cx="${kept.cx}" cy="${kept.cy}"/></a:xfrm>`
  expect(xml).toContain(frame)
  expect(xml.match(/<a:t>[^<]*<\/a:t>/g)).toEqual(["<a:t>Hello</a:t>"])
  note(`the exported slide1.xml carries ${frame} and still reads Hello`)
}
