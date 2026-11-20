import { expect } from "@playwright/test"
import { shortcutCopy, slideListCopy, transitionCopy } from "../bin/product-copy.mjs"
import { entryOf, namedSlides, selectTwoToFour } from "../look/slide-list-set.mjs"

export default async function drive({ page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("/")
  const entries = await namedSlides(page, 5)
  const deck = page.url().match(/\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
  const kinds = async () =>
    ((await post(deckRoutes.open, { deck }, cookie)).json.register.order ?? []).map((row) => row.slide)
  const titles = async () =>
    Promise.all(
      (await entries.all()).map(async (entry) => (await entry.innerText()).match(/Point \d of the story/)?.[0] ?? ""),
    )
  const selected = page.locator("[data-slide-list] [data-slide-entry][data-selected]")
  const named = (...numbers) => numbers.map((number) => `Point ${String(number)} of the story`)

  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await selectTwoToFour(page)
  await expect(selected).toHaveCount(3)
  await expect(page.locator("[data-design-panel]").first()).toContainText(slideListCopy.selected(3))
  await capture("three-selected")
  await entryOf(page, 3).click({ modifiers: ["ControlOrMeta"] })
  await expect(selected).toHaveCount(2)
  await capture("middle-taken-out")
  note(
    "Shift-click on slide 4 after slide 2 selected slides 2 to 4; Ctrl/Cmd-click took slide 3 out; Design said 3 slides selected",
  )

  await selectTwoToFour(page)
  await expect(selected).toHaveCount(3)
  await page.keyboard.press("ControlOrMeta+d")
  await expect(entries).toHaveCount(8)
  await capture("set-duplicated")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(entries).toHaveCount(5)

  await selectTwoToFour(page)
  await expect(selected).toHaveCount(3)
  await page.keyboard.press("Delete")
  await expect(entries).toHaveCount(2)
  await expect.poll(titles).toEqual(named(1, 5))
  await capture("set-deleted")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(entries).toHaveCount(5)
  await expect.poll(titles).toEqual(named(1, 2, 3, 4, 5))

  await entryOf(page, 2).click()
  await entryOf(page, 3).click({ modifiers: [shortcutCopy.chord.other.shift] })
  await entryOf(page, 2).dragTo(entryOf(page, 5))
  await expect.poll(titles).toEqual(named(1, 4, 5, 2, 3))
  await capture("set-dragged")
  const rows = await kinds()
  note(`slide order rows on the server: ${rows.join(", ")}`)
  await page.reload()
  await expect(entries).toHaveCount(5)
  await expect.poll(titles).toEqual(named(1, 4, 5, 2, 3))
  await capture("reloaded")
  note(
    "Ctrl+D, Delete, Undo and a drag each acted on the whole selected set; a reload kept the moved order 1, 4, 5, 2, 3",
  )
}
