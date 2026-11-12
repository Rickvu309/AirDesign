import { expect, test, type Page } from "@playwright/test"
import { join } from "node:path"
import { openRegister } from "../../packages/document/src/index.ts"

type Deck = { deck: string; name: string; edited: string; created: string; trashed?: string }
const now = "2026-11-11T12:00:00Z"
const first: Deck = { deck: "first", name: "Real presentation", edited: now, created: "2026-10-30T12:00:00Z" }
const second: Deck = { ...first, deck: "second", name: "Another presentation", edited: "2026-11-11T10:00:00Z" }

async function store(page: Page, decks: Deck[] = [first, second], trash: Deck[] = []) {
  const state = { decks: structuredClone(decks), trash: structuredClone(trash) }
  const calls: { path: string; body: Record<string, unknown> }[] = []
  await page.clock.install({ time: new Date(now) })
  await page.route("**/decks/*", async (route) => {
    const path = new URL(route.request().url()).pathname.split("/").at(-1) ?? ""
    const body = route.request().postDataJSON() as Record<string, unknown>
    calls.push({ path, body })
    if (path === "list") {
      await route.fulfill({ json: { ok: true, account: { email: "home@example.com" }, ...state } })
      return
    }
    if (path === "open") {
      await route.fulfill({ json: { ok: true, deck: body.deck, revision: 0, register: openRegister("", "") } })
      return
    }
    if (path === "trash") {
      const deck = state.decks.find((deck) => deck.deck === body.deck)
      state.decks = state.decks.filter((deck) => deck.deck !== body.deck)
      if (deck) state.trash.push({ ...deck, trashed: now })
    }
    if (path === "restore") {
      const deck = state.trash.find((deck) => deck.deck === body.deck)
      state.trash = state.trash.filter((deck) => deck.deck !== body.deck)
      if (deck) state.decks.push(deck)
    }
    if (path === "delete") {
      state.trash = state.trash.filter((deck) => !(body.decks as string[]).includes(deck.deck))
    }
    await route.fulfill({ json: { ok: true } })
  })
  return { state, calls }
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("home lists server decks instead of sample decks", async ({ page }) => {
  await store(page)
  await page.goto("/")
  await expect(page).toHaveTitle("AirDesign")
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([first.name, second.name])
  await expect(page.getByText("Edited just now", { exact: true })).toBeVisible()
  await expect(page.getByText("Edited 2 hours ago", { exact: true })).toBeVisible()
  await expect(page.getByText("home@example.com")).toBeVisible()
  await page.getByRole("link", { name: first.name }).click()
  await expect(page).toHaveURL(/\/deck\/first$/)
  await page.goBack()
  await expect(page.getByRole("heading", { name: first.name })).toBeVisible()
  await page.getByRole("link", { name: second.name }).click()
  await expect(page).toHaveURL(/\/deck\/second$/)
  await page.goBack()
  await expect(page.getByRole("heading", { name: second.name })).toBeVisible()
  await expect(page.getByText("Starred", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Project Atlas", { exact: true })).toHaveCount(0)
  await page.goto("/?view=list")
  await expect(page.getByText("Just now", { exact: true })).toBeVisible()
  await expect(page.getByText("Oct 30", { exact: true })).toHaveCount(2)
  await expect(page.getByText("Name", { exact: true })).toBeVisible()
  await expect(page.getByText("Created", { exact: true })).toBeVisible()
  await page.getByRole("link", { name: second.name }).click()
  await expect(page).toHaveURL(/\/deck\/second$/)
  await page.goto("/?view=list")
  await page.getByRole("link", { name: first.name }).click()
  await expect(page).toHaveURL(/\/deck\/first$/)
  await expect(page.locator(".thin-page")).toBeVisible()
})

test("signed out goes to sign-in with the path and query", async ({ page }) => {
  await page.route("**/decks/list", (route) => route.fulfill({ status: 401, json: { ok: false, refusal: "session" } }))
  await page.route("**/sign-in?*", (route) => route.fulfill({ body: "Sign in" }))
  await page.goto("/?view=list")
  await expect(page).toHaveURL(/\/sign-in\?next=%2F%3Fview%3Dlist$/)
})

test("empty home shows the designed first visit and import menu", async ({ page }) => {
  await store(page, [])
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Scratchpad" })).toBeVisible()
  await expect(page.getByText("Your first draft")).toBeVisible()
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await expect(page.getByRole("button", { name: "Import PowerPoint" })).toBeVisible()
  await expect(page.getByText("Blank deck", { exact: true })).toHaveCount(0)
})

test("choosing a file opens its deck and posts the filename rename", async ({ page }) => {
  const { calls } = await store(page, [])
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(process.cwd(), "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  expect(calls.find((call) => call.path === "rename")?.body).toEqual({
    deck: page.url().split("/").at(-1),
    name: "clean",
  })
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
})

test("back from a deck that was just imported shows the deck home", async ({ page }) => {
  await store(page, [])
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(process.cwd(), "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Scratchpad" })).toBeVisible()
  await expect(page.locator(".thin-page")).toHaveCount(0)
})

test("a refused import shows the designed failure and can be removed", async ({ page }) => {
  await store(page)
  await page.goto("/")
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "broken.pptx", mimeType: "application/octet-stream", buffer: Buffer.from("broken") })
  await expect(page.getByText("Unable to import", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Choose another file" })).toBeVisible()
  await page.getByRole("button", { name: "Remove", exact: true }).click()
  await expect(page.getByText("Unable to import", { exact: true })).toHaveCount(0)
})

test("move to Trash and Undo post trash and restore", async ({ page }) => {
  const { calls } = await store(page, [first])
  await page.goto("/")
  await page.getByRole("button", { name: "Move to Trash" }).click()
  await expect(page.getByText(`${first.name} moved to Trash`, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(page.getByRole("heading", { name: first.name })).toBeVisible()
  expect(calls.filter((call) => ["trash", "restore"].includes(call.path))).toEqual([
    { path: "trash", body: { deck: "first" } },
    { path: "restore", body: { deck: "first" } },
  ])
})

test("Trash counts whole days and restores a deck", async ({ page }) => {
  const { calls } = await store(page, [], [{ ...first, trashed: "2026-11-09T11:00:00Z" }])
  await page.goto("/trash")
  await expect(page.getByText("Deleted 2 days ago, 28 days left", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Restore", exact: true }).click()
  await expect(page.getByRole("heading", { name: first.name })).toHaveCount(0)
  expect(calls.find((call) => call.path === "restore")?.body).toEqual({ deck: "first" })
})

test("Empty Trash posts exactly the ids shown when the dialog opened", async ({ page }) => {
  const { state, calls } = await store(page, [second], [{ ...first, trashed: now }])
  await page.goto("/trash")
  await page.getByRole("button", { name: "Empty Trash", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Delete 1 deck for good?" })).toBeVisible()
  state.trash.push({ ...second, trashed: now })
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(page.getByRole("heading", { name: second.name, includeHidden: true })).toHaveCount(1)
  await page.getByRole("button", { name: "Delete for good", exact: true }).click()
  expect(calls.find((call) => call.path === "delete")?.body).toEqual({ decks: ["first"] })
  await expect(page.getByRole("heading", { name: first.name })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: second.name })).toBeVisible()
})

test("deck without an id returns home and rejects invalid ids", async ({ page }) => {
  await store(page)
  await page.goto("/deck")
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: first.name })).toBeVisible()
  await page.goto("/deck/invalid.id")
  await expect(page.getByText("Unknown screen")).toBeVisible()
})

test("a deck id of 64 characters opens and one of 65 never reaches the API", async ({ page }) => {
  const { calls } = await store(page)
  await page.goto(`/deck/${"a".repeat(65)}`)
  await expect(page.getByText("Unknown screen")).toBeVisible()
  expect(calls).toEqual([])
  await page.goto(`/deck/${"a".repeat(64)}`)
  await expect(page.locator(".thin-page")).toBeVisible()
  await expect(page.getByText("Unknown screen")).toHaveCount(0)
})

test("the Undo toast leaves on its own", async ({ page }) => {
  await store(page, [first])
  await page.goto("/")
  await page.getByRole("button", { name: "Move to Trash" }).click()
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible()
  await page.clock.fastForward(10000)
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveCount(0)
})

test("home with the only deck in Trash shows no sample decks", async ({ page }) => {
  await store(page, [], [{ ...first, trashed: now }])
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Trash" })).toBeVisible()
  await expect(page.getByText("Scratchpad", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Welcome to AirDesign", { exact: true })).toHaveCount(0)
})

test("a failed list shows the shell and no sample decks", async ({ page }) => {
  await page.route("**/decks/list", (route) => route.fulfill({ status: 500, body: "failed" }))
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Trash" })).toBeVisible()
  await expect(page.getByText("Scratchpad", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Project Atlas", { exact: true })).toHaveCount(0)
})

test("sign out from the account menu returns to sign-in and keeps deck data", async ({ page }) => {
  await store(page)
  const posted: string[] = []
  await page.route("**/sign-out", async (route) => {
    posted.push(route.request().method())
    await route.fulfill({ json: { ok: true } })
  })
  await page.route("**/sign-in?*", (route) => route.fulfill({ body: "Sign in" }))
  await page.goto("/")
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("deck-kept", 1)
        request.onupgradeneeded = () => request.result.createObjectStore("decks")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const tx = database.transaction("decks", "readwrite")
          tx.objectStore("decks").put({ name: "kept" }, "one")
          tx.oncomplete = () => {
            database.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
  await page.getByRole("button", { name: "home@example.com" }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/sign-in\?next=%2F$/)
  expect(posted).toEqual(["POST"])
  await page.goto("/")
  expect(
    await page.evaluate(
      () =>
        new Promise<unknown>((resolve, reject) => {
          let missing = false
          const request = indexedDB.open("deck-kept")
          request.onupgradeneeded = () => {
            missing = true
          }
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const database = request.result
            if (missing || !database.objectStoreNames.contains("decks")) {
              database.close()
              resolve("missing")
              return
            }
            const get = database.transaction("decks", "readonly").objectStore("decks").get("one")
            get.onerror = () => reject(get.error)
            get.onsuccess = () => {
              database.close()
              resolve(get.result)
            }
          }
        }),
    ),
  ).toEqual({ name: "kept" })
})

test("delete account asks for the account's email, then removes the device copy and goes to sign-in", async ({
  page,
}) => {
  await store(page)
  const posted: unknown[] = []
  await page.route("**/account/delete", async (route) => {
    posted.push(route.request().postDataJSON())
    await route.fulfill({ json: { ok: true } })
  })
  await page.route("**/sign-in?*", (route) => route.fulfill({ body: "Sign in" }))
  await page.goto("/")
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          request.result.close()
          resolve()
        }
      }),
  )
  const databases = () => page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name))
  expect(await databases()).toContain("airdesign")
  const open = async () => {
    await page.getByRole("button", { name: "home@example.com" }).click()
    await page.getByRole("menuitem", { name: "Delete account" }).click()
  }
  await open()
  const dialog = page.getByRole("dialog", { name: "Delete account" })
  await expect(dialog.getByText("Removes your decks and credits for good.")).toBeVisible()
  const remove = dialog.getByRole("button", { name: "Delete account" })
  await expect(remove).toBeDisabled()
  await dialog.getByLabel("Signed in with email").fill("other@example.com")
  await expect(remove).toBeDisabled()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
  expect(posted).toEqual([])
  await open()
  await dialog.getByLabel("Signed in with email").fill(" Home@Example.com ")
  await remove.click()
  await expect(page).toHaveURL(/\/sign-in\?next=%2F$/)
  expect(posted).toEqual([{ email: "home@example.com" }])
  expect(await databases()).not.toContain("airdesign")
})
