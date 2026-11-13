import { expect, type Page } from "@playwright/test"
import { forward, openClean, settled, signInBrowser, test } from "./api-stack"

const element = "ppt/slides/slide1.xml#2"
const start = [30, 30, 360, 120]
const moved = [60, 90, 360, 120]

test.use({ viewport: { width: 1600, height: 1000 } })

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

async function placed(page: Page): Promise<number[]> {
  return page
    .locator(`[data-canvas-element="${element}"]`)
    .evaluate((frame: HTMLElement) =>
      [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) => Number.parseFloat(each)),
    )
}

async function forgetDeckRows(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
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
            const row = at.value as unknown
            if (typeof row === "object" && row !== null && "kind" in row) at.delete()
            at.continue()
          }
        }
      }),
  )
}

async function pendingRows(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const all = database.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            database.close()
            resolve(
              (all.result as unknown[]).filter(
                (row) => typeof row === "object" && row !== null && "kind" in row && row.kind === "pending",
              ).length,
            )
          }
        }
      }),
  )
}

test("a person undoes a move, a text edit and a slide delete, redoes the move, and the server keeps it through a reload", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await openClean(page)
  const text = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeDisabled()

  await page.getByRole("button", { name: "Add slide" }).first().click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await entry(page, 1).click()

  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("slide")
  await text.click()
  const press = { x: slide.x + 300, y: slide.y + 150 }
  await page.mouse.move(press.x, press.y)
  await page.mouse.down()
  await page.mouse.move(press.x + 30, press.y + 60, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => placed(page)).toEqual(moved)
  await expect(page.getByRole("button", { name: "Undo move" })).toBeEnabled()

  await text.click()
  await page.keyboard.press("ControlOrMeta+a")
  await text.pressSequentially("Changed", { delay: 40 })
  await expect(text).toHaveText("Changed")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Undo text edit" })).toBeEnabled()

  await entry(page, 2).click()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Undo delete slide" })).toBeEnabled()

  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(page.getByRole("button", { name: "Redo delete slide" })).toBeEnabled()

  await page.keyboard.press("ControlOrMeta+z")
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await expect(text).toHaveText("Hello")

  await page.getByRole("button", { name: "Undo move" }).click()
  await expect.poll(() => placed(page)).toEqual(start)
  await expect(page.getByRole("button", { name: "Undo new slide" })).toBeEnabled()

  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(() => placed(page)).toEqual(moved)
  await expect(text).toHaveText("Hello")
  await expect(page.getByRole("button", { name: "Redo text edit" })).toBeEnabled()

  await expect.poll(() => pendingRows(page)).toBe(0)
  await forgetDeckRows(page)
  await page.reload()
  await settled(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(text).toHaveText("Hello")
  expect(await placed(page)).toEqual(moved)
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled()
})

test("an undo after an agent changed the same text changes nothing and says so", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  const text = page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await page.keyboard.press("ControlOrMeta+a")
  await text.pressSequentially("Mine", { delay: 40 })
  await page.keyboard.press("Escape")
  await expect.poll(() => pendingRows(page)).toBe(0)
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const read = (await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)) as {
    elements: { node: string; version: number }[]
  }
  const readAt = read.elements.find((each) => each.node === "256.2")?.version
  const changed = await stack.callTool(
    "airdesign_edit_deck",
    { deck, base, changes: [{ node: "256.2", readAt, value: '[{"from":0,"runs":[{"from":0,"text":"Agent"}]}]' }] },
    cookie,
  )
  expect(changed).toMatchObject({ ok: true })
  await expect(text).toHaveText("Agent")
  await page.getByRole("button", { name: "Undo text edit" }).click()
  await expect(page.getByText("Unable to undo. This changed after your edit, so it stays as it is.")).toBeVisible()
  await expect(text).toHaveText("Agent")
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled()
})

test("undoing a text edit paints the old text on the slide and its thumbnail without a reload", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await openClean(page)
  const text = page.locator('[data-slide-paint] [contenteditable="true"]')
  const thumbnail = entry(page, 1)
  await expect(thumbnail).toContainText("Hello")
  await text.click()
  await page.keyboard.press("ControlOrMeta+a")
  await text.pressSequentially("Mine", { delay: 40 })
  await page.keyboard.press("Escape")
  await expect(text).toHaveText("Mine")
  await expect(thumbnail).toContainText("Mine")
  await expect(page.getByRole("button", { name: "Undo text edit" })).toBeEnabled()

  await page.keyboard.press("ControlOrMeta+z")
  await expect(text).toHaveText("Hello")
  await expect(thumbnail).toContainText("Hello")
  await expect(thumbnail).not.toContainText("Mine")
  await expect(page.getByRole("button", { name: "Redo text edit" })).toBeEnabled()

  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(text).toHaveText("Mine")
  await expect(thumbnail).toContainText("Mine")
})

test("Ctrl+Z straight after typing over a text brings the old text back", async ({ page, context, stack }) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await openClean(page)
  const text = page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await page.keyboard.press("ControlOrMeta+a")
  await text.pressSequentially("Mine", { delay: 0 })
  await page.keyboard.press("ControlOrMeta+z")
  await expect(text).toHaveText("Hello", { timeout: 3000 })
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(text).toHaveText("Mine")
})
