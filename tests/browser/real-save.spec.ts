import { expect, type Page } from "@playwright/test"
import type { ReadDeckAnswer } from "../../packages/engine/src/index.ts"
import { forward, openClean, settled, signInBrowser, test, type SavedRegister } from "./api-stack"

const typed = "Saved on the server"

test.use({ viewport: { width: 1600, height: 1000 } })

test("home import exposes every untouched text box on slide one to the agent API", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  const readDeck = async () =>
    (await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)) as ReadDeckAnswer
  await expect.poll(async () => (await readDeck()).index).toBe("ready")
  const opened = await stack.post("/decks/open", { deck }, cookie)
  const register = opened.json.register as { index: { elements: { node: string; value: string | null }[] } }
  expect(opened.json.revision).toBe(0)
  const read = await readDeck()
  expect(read).toMatchObject({ ok: true, index: "ready", revision: 0, slides: [{ id: "256", position: 0 }] })
  expect(read.elements).toEqual([
    {
      node: "256.2",
      slide: "256",
      kind: "shape",
      grouped: false,
      value: '[{"from":0,"runs":[{"from":0,"text":"Hello"}]}]',
      version: 0,
      box: { x: 457200, y: 457200, cx: 5486400, cy: 1828800 },
      design: "fills accent1 · text.size 32 · text.color dk1",
    },
  ])
  expect(read.elements.map((element) => element.node)).toEqual(
    register.index.elements.filter((element) => element.value !== null).map((element) => element.node),
  )
})

function textOf(value: string): string {
  const paragraphs = JSON.parse(value) as { runs: { text: string }[] }[]
  return paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

function textsIn(register: SavedRegister): string[] {
  return Object.values(register.elements).flatMap((element) => {
    const last = element.landed.filter((landed) => landed.visible).at(-1)
    return last === undefined ? [] : [textOf(last.value)]
  })
}

async function deckRows(page: Page): Promise<{ kind: string; value: string }[]> {
  return page.evaluate(
    () =>
      new Promise<{ kind: string; value: string }[]>((resolve, reject) => {
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
                (row) => typeof row === "object" && row !== null && "kind" in row,
              ) as never,
            )
          }
        }
      }),
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

async function typeOver(page: Page, text: string): Promise<void> {
  const editor = page.locator('[contenteditable="true"]')
  await editor.dblclick()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially(text, { delay: 50 })
  await expect(editor).toHaveText(text)
}

async function confirmedText(page: Page, text: string): Promise<void> {
  await expect
    .poll(async () => {
      const rows = await deckRows(page)
      return {
        pending: rows.filter((row) => row.kind === "pending").length,
        last: rows.map((row) => textOf(row.value)),
      }
    })
    .toMatchObject({ pending: 0, last: expect.arrayContaining([text]) })
}

test("home import through the first typed edit opens the deck exactly once", async ({ page, context, stack }) => {
  await signInBrowser(context, await stack.signIn())
  const asked = await forward(page, stack)
  await openClean(page)
  await typeOver(page, typed)
  await confirmedText(page, typed)
  expect(asked.filter((path) => path === "/decks/open")).toHaveLength(1)
})

test("a first typed edit that lands before the server answers the open still opens the deck exactly once", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  const asked = await forward(page, stack)
  let slow = true
  await page.route("**/decks/open", async (route) => {
    if (slow) {
      slow = false
      await new Promise((resolve) => setTimeout(resolve, 2500))
    }
    await route.fallback()
  })
  await openClean(page)
  await typeOver(page, typed)
  await confirmedText(page, typed)
  await expect.poll(() => asked.filter((path) => path === "/decks/watch").length).toBeGreaterThan(0)
  expect(asked.filter((path) => path === "/decks/open")).toHaveLength(1)
})

test("opening an existing deck from the deck list through the first typed edit opens it exactly once", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  const asked = await forward(page, stack)
  const deck = await openClean(page)
  await typeOver(page, typed)
  await confirmedText(page, typed)
  await forgetDeckRows(page)
  await page.goto("/")
  const before = asked.filter((path) => path === "/decks/open").length
  await page.locator(`a[href="/deck/${deck}"]`).click()
  await settled(page)
  await typeOver(page, `${typed} again`)
  await confirmedText(page, `${typed} again`)
  expect(asked.filter((path) => path === "/decks/open").slice(before)).toHaveLength(1)
})

test("an edit made while the server cannot be reached lands once it answers again, with no new edit", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  await typeOver(page, typed)
  await confirmedText(page, typed)
  const revision = async () => (await stack.post("/decks/open", { deck }, cookie)).json.revision as number
  const before = await revision()
  const unreachable = (url: URL) => url.pathname.startsWith("/decks/")
  await page.route(unreachable, (route) => route.abort("connectionfailed"))
  await typeOver(page, "Kept on this device")
  await expect(page.getByText(/Edits are saved on this device/)).toBeVisible()
  expect(await revision()).toBe(before)
  await page.unroute(unreachable)
  await expect.poll(revision, { timeout: 15_000 }).toBeGreaterThan(before)
  await confirmedText(page, "Kept on this device")
  expect(textsIn((await stack.saved(deck))?.register ?? { elements: {} })).toEqual(["Kept on this device"])
  await expect(page.getByText(/Edits are saved on this device/)).toHaveCount(0)
})

test("a typed edit lands in Postgres and comes back from the server", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  const asked = await forward(page, stack)
  const deck = await openClean(page)
  await typeOver(page, typed)
  await confirmedText(page, typed)
  const firstCommit = asked.indexOf("/decks/commit")
  expect(firstCommit).toBeGreaterThan(0)
  expect(asked.filter((path) => path === "/decks/open")).toHaveLength(1)
  expect(asked.filter((path) => path === "/decks/commit").length).toBeGreaterThan(0)

  const saved = await stack.saved(deck)
  expect(saved?.owner).toBe(await stack.emailOf(cookie))
  expect(saved === undefined ? [] : textsIn(saved.register)).toEqual([typed])

  const opened = await stack.post("/decks/open", { deck }, cookie)
  expect(opened.status).toBe(200)
  expect(opened.json.ok).toBe(true)
  expect(textsIn(opened.json.register as SavedRegister)).toEqual([typed])

  await forgetDeckRows(page)
  expect(await deckRows(page)).toEqual([])
  await page.reload()
  await settled(page)
  await expect(page.locator('[contenteditable="true"]')).toHaveText(typed)
})

test("a second account opening the deck is refused owner", async ({ page, context, stack }) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  const deck = await openClean(page)
  await typeOver(page, typed)
  await confirmedText(page, typed)
  const other = await stack.signIn()
  const refused = await stack.post("/decks/open", { deck }, other)
  expect(refused.json).toEqual({ ok: false, refusal: "owner" })
  expect(textsIn((await stack.saved(deck))?.register ?? { elements: {} })).toEqual([typed])
})

test("a deck deleted on the server closes the editor, takes no edit and does not come back after a reload", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  const asked = await forward(page, stack)
  const deck = await openClean(page)
  await typeOver(page, typed)
  await confirmedText(page, typed)
  expect((await stack.post("/decks/trash", { deck }, cookie)).json.ok).toBe(true)
  expect((await stack.post("/decks/delete", { decks: [deck] }, cookie)).json.ok).toBe(true)
  await expect(page.locator("[data-deck-refused]")).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  const commits = asked.filter((path) => path === "/decks/commit").length
  await page.reload()
  await expect(page.locator("[data-deck-refused]")).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  expect(asked.filter((path) => path === "/decks/commit")).toHaveLength(commits)
  expect(await stack.saved(deck)).toBeUndefined()
})

test("a new slide whose commit answer was lost still opens after the reloads that follow, and lands once", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  const committing = (url: URL) => url.pathname === "/decks/commit"
  await page.route(committing, async (route) => {
    const batch = (route.request().postDataJSON() as { batch: { slide?: string }[] }).batch
    if (!batch.some((row) => row.slide !== undefined)) {
      await route.fallback()
      return
    }
    await route.fetch({ url: `${stack.origin}/decks/commit`, headers: await route.request().allHeaders() })
    await route.abort()
  })
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect
    .poll(async () => ((await stack.post("/decks/open", { deck }, cookie)).json.register as { order: unknown[] }).order)
    .toHaveLength(1)
  await page.unroute(committing)
  for (const round of [1, 2]) {
    await page.reload()
    await expect(page.locator(".thin-page"), `reload ${String(round)}`).toHaveAttribute("data-deck-ready", deck)
    await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  }
  await expect.poll(async () => (await deckRows(page)).filter((row) => row.kind === "pending")).toHaveLength(0)
  const saved = await stack.post("/decks/open", { deck }, cookie)
  expect((saved.json.register as { order: unknown[] }).order).toHaveLength(1)
})
