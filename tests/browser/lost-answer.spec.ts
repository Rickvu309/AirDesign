import { expect, type Page } from "@playwright/test"
import { forward, signInBrowser, test } from "./api-stack"

test.use({ viewport: { width: 1600, height: 1000 } })

type SlideRow = { readonly kind: string; readonly slideFile?: string[]; readonly slideEdit?: Record<string, unknown> }

function rowsIn(page: Page): Promise<SlideRow[]> {
  return page.evaluate(
    () =>
      new Promise<SlideRow[]>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const all = database.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            database.close()
            resolve(
              (all.result as SlideRow[]).filter((row) => typeof row === "object" && row !== null && "kind" in row),
            )
          }
        }
      }),
  )
}

function plantConfirmedCopy(page: Page): Promise<void> {
  return page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const writing = database.transaction("rows", "readwrite")
          writing.onerror = () => reject(writing.error)
          writing.oncomplete = () => {
            database.close()
            resolve()
          }
          const store = writing.objectStore("rows")
          const cursor = store.openCursor()
          cursor.onsuccess = () => {
            const at = cursor.result
            if (at === null) return
            const row = at.value as { kind?: string; slideEdit?: unknown; deck?: string; slideFile?: unknown }
            if (row.kind === "pending" && row.slideEdit !== undefined) {
              const key = String(at.key).replace(/\u0000p\u0000\d{12}$/, "\u0000c\u0000000000000999")
              store.put(
                {
                  kind: "confirmed",
                  deck: row.deck,
                  revision: 999,
                  value: "",
                  slideFile: row.slideFile,
                  slideEdit: row.slideEdit,
                },
                key,
              )
            }
            at.continue()
          }
        }
      }),
  )
}

test("a deck stuck with a landed new slide still pending on this device opens and heals on reload", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  let landed = false
  const committing = (url: URL) => url.pathname === "/decks/commit"
  await page.route(committing, async (route) => {
    if (!landed) {
      landed = true
      await route.fetch({ url: `${stack.origin}/decks/commit`, headers: await route.request().allHeaders() })
    }
    await route.abort()
  })
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  const order = async () =>
    ((await stack.post("/decks/open", { deck }, cookie)).json.register as { order: unknown[] }).order
  await expect.poll(order).toHaveLength(1)
  await expect.poll(async () => (await rowsIn(page)).filter((row) => row.kind === "pending")).toHaveLength(1)
  await plantConfirmedCopy(page)
  const planted = (await rowsIn(page)).filter((row) => row.slideEdit?.slide === "add").map((row) => row.kind)
  expect(planted.filter((kind) => kind === "pending")).toHaveLength(1)
  expect(planted.filter((kind) => kind === "confirmed").length).toBeGreaterThan(0)
  await page.unroute(committing)
  for (const round of [1, 2]) {
    await page.reload()
    expect(await decks.ready(), `reload ${String(round)}`).toBe(deck)
    await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  }
  await expect
    .poll(async () => (await rowsIn(page)).filter((row) => row.slideEdit?.slide === "add").map((row) => row.kind))
    .toEqual(["confirmed"])
  expect(await order()).toHaveLength(1)
  expect(errors).toEqual([])
})

test("a new slide another writer's slide took the place of is set aside, and the editor says so", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  const committing = (url: URL) => url.pathname === "/decks/commit"
  await page.route(committing, (route) => route.abort())
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect.poll(async () => (await rowsIn(page)).filter((row) => row.kind === "pending")).toHaveLength(1)
  const mine = (await rowsIn(page)).find((row) => row.kind === "pending")
  if (mine?.slideEdit === undefined || mine.slideFile === undefined) throw new Error("no pending slide")
  const theirs = await stack.post(
    "/decks/commit",
    { deck, batch: [{ ...mine.slideEdit, file: mine.slideFile }] },
    cookie,
  )
  expect(theirs.json).toMatchObject({ ok: true, revision: 1 })
  await page.unroute(committing)
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  await expect(
    page.getByText("Unable to save some edits. The deck changed, so make them again if you need them.", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect.poll(async () => (await rowsIn(page)).filter((row) => row.kind === "pending")).toHaveLength(0)
  const saved = await stack.post("/decks/open", { deck }, cookie)
  expect(saved.json.revision).toBe(1)
  await page.reload()
  expect(await decks.ready()).toBe(deck)
  await expect(page.getByText("Unable to save some edits", { exact: false })).toHaveCount(0)
})
