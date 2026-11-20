import { expect, type Page } from "@playwright/test"
import { forward, signInBrowser, test, type SavedRegister } from "./api-stack"

test.use({ viewport: { width: 1600, height: 1000 } })

const requestLimit = 1_000_000
const kept = 80
const committing = (url: URL) => url.pathname === "/decks/commit"

function saveStatus(page: Page) {
  return page.locator("[data-save-status]")
}

async function typeAtEnd(page: Page, text: string): Promise<void> {
  const editor = page.locator('[contenteditable="true"]')
  await editor.dblclick()
  await page.keyboard.press("ControlOrMeta+End")
  await editor.pressSequentially(text, { delay: 50 })
}

function lastText(register: SavedRegister): string | undefined {
  const values = Object.values(register.elements).flatMap((element) => {
    const last = element.landed.filter((landed) => landed.visible && typeof landed.value === "string").at(-1)
    return last === undefined ? [] : [last.value]
  })
  const value = values.at(-1)
  if (value === undefined) return undefined
  const paragraphs = JSON.parse(value) as { runs: { text: string }[] }[]
  return paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

function largeText(index: number): string {
  return `${'"'.repeat(3_700)}${String(index)}`
}

function keepLargeEdits(page: Page, count: number, once: string | null, width = 3_700): Promise<number> {
  return page.evaluate(
    ({ count, once, quotes }) =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const writing = database.transaction("rows", "readwrite")
          const store = writing.objectStore("rows")
          const cursor = store.openCursor()
          let written = 0
          writing.onerror = () => reject(writing.error)
          writing.oncomplete = () => {
            database.close()
            resolve(written)
          }
          cursor.onsuccess = () => {
            const at = cursor.result
            if (at === null) return
            const { once: _sealed, ...row } = at.value as {
              kind?: string
              order?: number
              base?: number
              value?: string
              once?: string
            }
            if (
              row.kind === "pending" &&
              typeof row.order === "number" &&
              typeof row.base === "number" &&
              typeof row.value === "string"
            ) {
              const key = String(at.key)
              const paragraphs = JSON.parse(row.value) as { runs: { text: string }[] }[]
              for (let index = 0; index < count; index += 1) {
                const order = row.order + 1 + index
                const runs = paragraphs[0]?.runs ?? []
                const value = JSON.stringify([{ ...paragraphs[0], runs: [{ ...runs[0], text: `${quotes}${index}` }] }])
                const base = row.base + 1 + index
                const planted = { ...row, order, base, value, ...(once === null ? {} : { once }) }
                store.put(planted, key.replace(/\d{12}$/, String(order).padStart(12, "0")))
                written += 1
              }
              store.put(once === null ? row : { ...row, once }, key)
              return
            }
            at.continue()
          }
        }
      }),
    { count, once, quotes: '"'.repeat(width) },
  )
}

function watchCommits(page: Page): { bodies: number[]; refused: number[] } {
  const seen = { bodies: [] as number[], refused: [] as number[] }
  page.on("request", (request) => {
    if (committing(new URL(request.url()))) seen.bodies.push(request.postDataBuffer()?.length ?? 0)
  })
  page.on("response", (response) => {
    if (committing(new URL(response.url())) && response.status() === 413) seen.refused.push(response.status())
  })
  return seen
}

async function keptOnDevice(page: Page): Promise<void> {
  await page.route(committing, (route) => route.abort("connectionfailed"))
  await typeAtEnd(page, "!")
  await expect(saveStatus(page)).toHaveText("Unable to reach AirDesign")
}

test("edits kept on this device that together pass the request limit all save, and a later edit saves too", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  await keptOnDevice(page)
  expect(await keepLargeEdits(page, kept, null)).toBe(kept)
  const commits = watchCommits(page)
  await page.unroute(committing)
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  await expect(saveStatus(page)).toHaveText("Saved", { timeout: 20_000 })
  expect(commits.refused).toEqual([])
  expect(commits.bodies.length).toBeGreaterThan(1)
  expect(commits.bodies.every((bytes) => bytes <= requestLimit)).toBe(true)
  expect(commits.bodies.reduce((sum, bytes) => sum + bytes, 0)).toBeGreaterThan(requestLimit)
  const saved = await stack.saved(deck)
  expect(saved === undefined ? undefined : lastText(saved.register)).toBe(largeText(kept - 1))
  await page.reload()
  await expect(saveStatus(page)).toHaveText("Saved")
  await typeAtEnd(page, "?")
  await expect(saveStatus(page)).toHaveText("Saved", { timeout: 15_000 })
  await expect
    .poll(async () => {
      const after = await stack.saved(deck)
      return after === undefined ? undefined : lastText(after.register)
    })
    .toBe(`${largeText(kept - 1)}?`)
})

test("a device stuck on a sealed batch the server refused as too large saves it all on the next open", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  await keptOnDevice(page)
  expect(await keepLargeEdits(page, kept, "stuck-batch")).toBe(kept)
  await page.unroute(committing)
  const commits = watchCommits(page)
  await page.reload()
  await expect
    .poll(
      async () => {
        const saved = await stack.saved(deck)
        return saved === undefined ? undefined : lastText(saved.register)
      },
      { timeout: 20_000 },
    )
    .toBe(largeText(kept - 1))
  await expect(saveStatus(page)).toHaveText("Saved")
  expect(commits.refused).toEqual([413])
  expect(commits.bodies.slice(1).every((bytes) => bytes <= requestLimit)).toBe(true)
  await typeAtEnd(page, "?")
  await expect(saveStatus(page)).toHaveText("Saved", { timeout: 15_000 })
  await expect
    .poll(async () => {
      const after = await stack.saved(deck)
      return after === undefined ? undefined : lastText(after.register)
    })
    .toBe(`${largeText(kept - 1)}?`)
})

test("an edit too large for any request is set aside, and the editor says it was too large to save", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  await keptOnDevice(page)
  expect(await keepLargeEdits(page, 1, "stuck-batch", requestLimit)).toBe(1)
  await page.unroute(committing)
  await page.reload()
  await expect(
    page.getByText("Unable to save an edit. It was too large to save, so an export of this deck does not include it."),
  ).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText("The deck changed")).toHaveCount(0)
  await expect
    .poll(async () => {
      const saved = await stack.saved(deck)
      return saved === undefined ? undefined : lastText(saved.register)
    })
    .not.toContain('"'.repeat(1000))
})
