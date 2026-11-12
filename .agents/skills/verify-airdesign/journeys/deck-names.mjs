import path from "node:path"
import { expect } from "@playwright/test"

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  const named = async (deck) =>
    (await post(deckRoutes.list, {}, cookie)).json.decks.find((each) => each.deck === deck)?.name
  const decks = []
  for (const round of [1, 2]) {
    await page.goto("/")
    await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
    await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
    const deck = page.url().split("/").at(-1)
    await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
    await expect.poll(() => named(deck), { timeout: 15_000 }).toBe("clean")
    decks.push(deck)
    note(`imported deck ${String(round)}, which the server names clean`)
  }

  const title = page.getByRole("button", { name: "Rename deck: clean" })
  await title.click()
  const field = page.getByRole("textbox", { name: "Deck name" })
  await expect(field).toBeFocused()
  await field.fill("Board pack")
  await field.press("Enter")
  const renamed = page.getByRole("button", { name: "Rename deck: Board pack" })
  await expect(renamed).toBeFocused()
  await expect(page).toHaveTitle("Board pack - AirDesign")
  await expect.poll(() => named(decks[1]), { timeout: 15_000 }).toBe("Board pack")
  await capture("renamed")
  note("renamed from the title: the button, the tab and the server read Board pack")
  await renamed.click()
  await field.fill("")
  await field.press("Enter")
  await expect(page.getByRole("alert")).toHaveText("Enter a name for this deck.")
  await capture("rename-refused")
  await field.press("Escape")
  await expect(renamed).toBeFocused()
  expect(await named(decks[1])).toBe("Board pack")
  note("an empty name was refused with Enter a name for this deck., and Escape kept Board pack")

  await expect(page.getByRole("button", { name: "Design, not available yet" })).toBeDisabled()
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export" }).click()
  expect((await saving).suggestedFilename()).toBe("Board pack.pptx")
  await expect(page.getByText("Board pack.pptx downloaded", { exact: true })).toBeVisible()
  await capture("downloaded")
  note("Design is off and named so; Export saved Board pack.pptx and said Board pack.pptx downloaded")

  await page.goBack()
  await page.getByRole("link", { name: "All decks" }).click()
  await expect(page).toHaveURL(/\/all$/)
  const main = page.getByRole("main")
  await expect(main.getByRole("heading", { name: "All decks", level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: "All decks" })).toHaveAttribute("aria-current", "page")
  await expect(main.getByRole("heading", { name: "Board pack", level: 2 })).toBeVisible()
  await expect(main.getByRole("heading", { name: "clean", level: 2 })).toBeVisible()
  await capture("all-decks")
  const search = page.getByRole("searchbox", { name: "Search" })
  await search.fill("board")
  await expect(page).toHaveURL(/q=board/)
  await expect(main.getByRole("heading", { name: "clean", level: 2 })).toHaveCount(0)
  await page.reload()
  await expect(search).toHaveValue("board")
  await expect(main.getByRole("heading", { name: "Board pack", level: 2 })).toBeVisible()
  await expect(main.getByRole("heading", { name: "clean", level: 2 })).toHaveCount(0)
  await capture("search-match")
  await search.fill("nothing here")
  await expect(main.getByRole("heading", { name: "No decks match “nothing here”" })).toBeVisible()
  await capture("search-empty")
  await main.getByRole("button", { name: "Clear search" }).click()
  await expect(search).toHaveValue("")
  await expect(main.getByRole("heading", { name: "clean", level: 2 })).toBeVisible()
  note(
    "All decks listed both decks; search board left Board pack through a reload; a miss showed No decks match and Clear search brought both back",
  )
}
