import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { expect, test } from "@playwright/test"
import { join } from "node:path"
import { first, now, second, store } from "./home-store.ts"
import { accountCopy } from "../../apps/web/src/copy/account-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"

test.use({ viewport: { width: 1600, height: 1000 } })

test("home lists server decks instead of sample decks", async ({ page }) => {
  await store(page)
  await page.goto("/")
  await expect(page).toHaveTitle("AirDesign")
  await expect(page.locator("[data-decks-main]").getByRole("heading", { level: 2 })).toHaveText([
    first.name,
    second.name,
  ])
  await expect(page.getByText("Edited just now", { exact: true })).toBeVisible()
  await expect(page.getByText("Edited 2 hours ago", { exact: true })).toBeVisible()
  await expect(page.locator("[data-account-name]")).toHaveText("Home")
  await page.getByRole("link", { name: first.name }).click()
  await expect(page).toHaveURL(/\/deck\/first$/)
  await page.goBack()
  await expect(page.getByRole("heading", { name: first.name })).toBeVisible()
  await page.getByRole("link", { name: second.name }).click()
  await expect(page).toHaveURL(/\/deck\/second$/)
  await page.goBack()
  await expect(page.getByRole("heading", { name: second.name })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Starred" })).toHaveText("StarredStar a deck to keep it here.")
  await expect(page.getByText("Project Atlas", { exact: true })).toHaveCount(0)
  await page.goto("/?view=list")
  await expect(page.getByText("Just now", { exact: true })).toBeVisible()
  await expect(page.getByText("Oct 30", { exact: true })).toHaveCount(2)
  await expect(page.getByText("Name", { exact: true })).toBeVisible()
  await expect(page.getByText("Created", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /^(Name|Edited|Created)$/ })).toHaveCount(0)
  await expect(page.getByText("Edited", { exact: true }).locator("svg")).toHaveCount(0)
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

test("empty home says there are no decks yet, lists no sample decks and offers the import menu", async ({ page }) => {
  await store(page, [])
  await page.goto("/")
  await expect(page.locator("[data-account-name]")).toHaveText("Home")
  await expect(page.getByRole("heading", { name: "No decks yet" })).toBeVisible()
  await expect(page.getByText("Scratchpad", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Welcome to AirDesign", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Import PowerPoint" })).toHaveCount(1)
  await expect(page.getByRole("button", { name: productCopy.blankDeck, exact: true })).toHaveCount(1)
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
  const menu = page.getByRole("menu", { name: productCopy.newDeck })
  await expect(menu.getByRole("menuitem", { name: "Import PowerPoint" })).toHaveCount(1)
  await expect(menu.getByRole("menuitem", { name: productCopy.blankDeck, exact: true })).toHaveCount(1)
})

test("choosing a file opens its deck and posts the filename rename", async ({ page }) => {
  const { calls } = await store(page, [])
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(process.cwd(), "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect
    .poll(() => calls.find((call) => call.path === "rename")?.body)
    .toEqual({ deck: page.url().split("/").at(-1), name: "clean" })
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
})

test("an imported deck opens in the editor while the server has not answered", async ({ page }) => {
  const { calls } = await store(page, [])
  await page.goto("/")
  const held: (() => void)[] = []
  await page.route(/\/decks\/(?!list$)[a-z-]+$/, (route) => {
    held.push(() => void route.fallback())
  })
  await page.locator("input[type=file]").setInputFiles(join(process.cwd(), "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toBeVisible()
  expect(calls.filter((call) => call.path !== "list")).toEqual([])
  await page.unroute(/\/decks\/(?!list$)[a-z-]+$/)
  for (const release of held.splice(0)) release()
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await expect
    .poll(() => calls.find((call) => call.path === "rename")?.body)
    .toEqual({ deck: page.url().split("/").at(-1), name: "clean" })
})

test("back from a deck that was just imported shows the deck home", async ({ page }) => {
  const { calls } = await store(page, [])
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(process.cwd(), "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toBeVisible()
  await expect.poll(() => calls.some((call) => call.path === "rename" && call.body.name === "clean")).toBe(true)
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "clean", level: 2 })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Scratchpad" })).toHaveCount(0)
  await expect(page.locator(".thin-page")).toHaveCount(0)
})

test("a refused import shows the designed failure, focuses the way out, and can be removed", async ({ page }) => {
  await store(page)
  await page.goto("/")
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "broken.pptx", mimeType: "application/octet-stream", buffer: Buffer.from("broken") })
  await expect(page.getByText("Unable to open this file", { exact: true })).toBeVisible()
  const refused = page.getByRole("alert")
  await expect(refused).toContainText(
    "Open it in PowerPoint and save it as a .pptx file without a password, then import that copy.",
  )
  await expect(refused.getByRole("button", { name: "Choose another file" })).toBeFocused()
  await page.getByRole("button", { name: "Remove", exact: true }).click()
  await expect(page.getByText("Unable to open this file", { exact: true })).toHaveCount(0)
})

test("a file that is not a PowerPoint is refused with words of its own", async ({ page }) => {
  await store(page)
  await page.goto("/")
  const emptyZip = Buffer.from([0x50, 0x4b, 0x05, 0x06, ...Array.from({ length: 18 }, () => 0)])
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "archive.pptx", mimeType: "application/octet-stream", buffer: emptyZip })
  await expect(page.getByRole("alert").getByText("This file isn't a PowerPoint deck", { exact: true })).toBeVisible()
  await expect(page.getByRole("alert")).toContainText("Choose a PowerPoint file that ends in .pptx.")
  await expect(page.getByRole("alert").getByRole("button", { name: "Choose another file" })).toBeFocused()
})

test("move to Trash and Undo post trash and restore", async ({ page }) => {
  const { calls } = await store(page, [first])
  await page.goto("/")
  await page.getByRole("button", { name: `${first.name} actions` }).click()
  await page.getByRole("menuitem", { name: "Move to Trash" }).click()
  await expect(page.getByText(`${first.name} moved to Trash`, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: undoCopy.undo, exact: true }).click()
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
  await expect(page.getByRole("heading", { name: productCopy.addressNotFoundTitle })).toBeVisible()
})

test("a deck id of 64 characters opens and one of 65 never reaches the API", async ({ page }) => {
  const { calls } = await store(page)
  await page.goto(`/deck/${"a".repeat(65)}`)
  await expect(page.getByRole("heading", { name: productCopy.addressNotFoundTitle })).toBeVisible()
  expect(calls).toEqual([])
  await page.goto(`/deck/${"a".repeat(64)}`)
  await expect(page.locator(".thin-page")).toBeVisible()
  await expect(page.getByRole("heading", { name: productCopy.addressNotFoundTitle })).toHaveCount(0)
})

test("the Undo toast stays until keyboard dismissal without restoring the deck", async ({ page }) => {
  const { state } = await store(page, [first])
  await page.goto("/")
  await page.getByRole("button", { name: `${first.name} actions` }).click()
  await page.getByRole("menuitem", { name: "Move to Trash" }).click()
  await expect(page.getByRole("button", { name: undoCopy.undo, exact: true })).toBeVisible()
  await page.clock.fastForward(10000)
  await expect(page.getByRole("button", { name: undoCopy.undo, exact: true })).toBeVisible()
  await page.getByRole("button", { name: productCopy.close, exact: true }).focus()
  await page.keyboard.press(slideListCopy.openKey)
  await expect(page.getByRole("button", { name: undoCopy.undo, exact: true })).toHaveCount(0)
  expect(state.trash.map((deck) => deck.deck)).toEqual([first.deck])
})

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`the moved-to-Trash toast ${reducedMotion === "reduce" ? "does not move" : "slides"} under ${reducedMotion}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion })
    await store(page, [first])
    await page.goto("/")
    await page.getByRole("button", { name: `${first.name} actions` }).click()
    await page.getByRole("menuitem", { name: "Move to Trash" }).click()
    const toast = page.locator("[data-sonner-toast]")
    await expect(toast.getByRole("button", { name: undoCopy.undo, exact: true })).toBeVisible()
    const property = await toast.evaluate((element) => getComputedStyle(element).transitionProperty)
    if (reducedMotion === "reduce") expect(property).toBe("none")
    else expect(property).toContain("transform")
  })
}

test("home with the only deck in Trash shows the empty state pointing forward and no sample decks", async ({
  page,
}) => {
  await store(page, [], [{ ...first, trashed: now }])
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Trash" })).toBeVisible()
  await expect(page.getByText("Scratchpad", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Welcome to AirDesign", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "No decks yet" })).toBeVisible()
  await expect(page.getByText("Decks hold your slides, ready to edit or export to PowerPoint.")).toBeVisible()
  await expect(page.getByRole("button", { name: productCopy.blankDeck })).toBeVisible()
  await expect(page.getByRole("button", { name: "Import PowerPoint" })).toBeVisible()
  await page.goto("/?view=list")
  await expect(page.getByRole("heading", { name: "No decks yet" })).toBeVisible()
  await expect(page.getByText("Name", { exact: true })).toHaveCount(0)
})

test("a failed list shows the shell and no sample decks", async ({ page }) => {
  await page.route("**/decks/list", (route) => route.fulfill({ status: 500, body: "failed" }))
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Trash" })).toBeVisible()
  await expect(page.getByText("Scratchpad", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Project Atlas", { exact: true })).toHaveCount(0)
})

test("deck home shows a loading state until the list arrives and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  let resolveRoute: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    resolveRoute = resolve
  })
  await page.route("**/decks/list", async (route) => {
    await gate
    await route.fulfill({ json: { ok: true, account: { email: "home@example.com" }, decks: [first], trash: [] } })
  })
  await page.goto("/")
  const loading = page.locator('[data-loading="true"]')
  await expect(loading).toBeVisible()
  const skeleton = page.locator('[data-slot="skeleton"]')
  await expect(skeleton).toHaveCount(9)
  await expect(skeleton.first()).toHaveCSS("animation-name", "none")
  resolveRoute?.()
  await expect(loading).toHaveCount(0)
  await expect(page.getByRole("heading", { name: first.name })).toBeVisible()
})

test("a failed list shows a message, retries when asked, and returns focus to the page title", async ({ page }) => {
  let shouldFail = true
  await page.route("**/decks/list", async (route) => {
    if (shouldFail) {
      await route.fulfill({ status: 500, body: "failed" })
      return
    }
    await route.fulfill({ json: { ok: true, account: { email: "home@example.com" }, decks: [first], trash: [] } })
  })
  await page.goto("/")
  const failure = page.getByRole("alert")
  await expect(failure.getByRole("heading", { name: "Unable to load your decks" })).toBeVisible()
  await expect(failure.getByText("Check your connection and try again.")).toBeVisible()
  const tryAgain = failure.getByRole("button", { name: "Try again" })
  shouldFail = false
  await tryAgain.click()
  await expect(page.getByRole("heading", { name: first.name })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Unable to load your decks" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Recents", level: 1 })).toBeFocused()
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
  const dialog = page.getByRole("dialog", { name: "Delete your account?" })
  await expect(dialog.getByText(accountCopy.deleteBody)).toBeVisible()
  const remove = dialog.getByRole("button", { name: "Delete account" })
  await expect(remove).toBeDisabled()
  await dialog.getByLabel("Type your email to confirm").fill("other@example.com")
  await expect(remove).toBeDisabled()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
  expect(posted).toEqual([])
  await open()
  await dialog.getByLabel("Type your email to confirm").fill(" Home@Example.com ")
  await remove.click()
  await expect(page).toHaveURL(/\/sign-in\?next=%2F$/)
  expect(posted).toEqual([{ email: "home@example.com" }])
  expect(await databases()).not.toContain("airdesign")
})
