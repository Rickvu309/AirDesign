import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { forward, signInBrowser, test } from "./api-stack"
import { first, store } from "./home-store.ts"
import { decksOn } from "./deck-test"

const fixtures = ["clean.pptx", "blank.pptx", "picture-png.pptx"].map((name) =>
  join(process.cwd(), "scripts/pptx-fixtures", name),
)

test.use({ viewport: { width: 1470, height: 923 } })

async function imported(page: Page, file: string): Promise<string> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForFunction(() => /^\/deck\/[A-Za-z0-9_-]{1,64}$/.test(location.pathname))
  await decksOn(page).ready()
  return new URL(page.url()).pathname.slice("/deck/".length)
}

async function clickPreview(page: Page, name: string): Promise<void> {
  const box = await card(page, name).locator("[data-deck-preview]").boundingBox()
  if (box === null) throw new Error(`no preview for ${name}`)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

function card(page: Page, name: string) {
  return page.locator("[data-decks-main] article").filter({ has: page.getByRole("heading", { name, exact: true }) })
}

test("each deck card shows its first slide, opens its deck from the preview, and moves to Trash from its menu", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  const decks = []
  for (const file of fixtures) decks.push(await imported(page, file))
  await page.goto("/")
  await expect(page.locator("[data-decks-main] article [data-deck-preview] [data-thumb-paint]")).toHaveCount(3)
  await expect(page.locator("[data-decks-main] article [data-deck-initial]")).toHaveCount(0)
  await expect
    .poll(() =>
      card(page, "picture-png")
        .locator("[data-thumb-paint]")
        .evaluate((paint) =>
          [...paint.querySelectorAll("*")].some((each) => getComputedStyle(each).backgroundImage.includes("blob:")),
        ),
    )
    .toBe(true)
  await clickPreview(page, "clean")
  await expect(page).toHaveURL(new RegExp(`/deck/${decks[0] ?? ""}$`))
  await page.goto("/")
  await expect(card(page, "clean").getByRole("button", { name: "Move to Trash" })).toHaveCount(0)
  await card(page, "clean").getByRole("button", { name: "clean actions" }).click()
  await page.getByRole("menuitem", { name: "Move to Trash" }).click()
  await expect(page.getByText("clean moved to Trash", { exact: true })).toBeVisible()
  await expect(card(page, "clean")).toHaveCount(0)
  await page.goto("/trash")
  await expect(card(page, "clean").locator("[data-thumb-paint]")).toHaveCount(1)
  await expect(card(page, "clean").getByRole("link")).toHaveCount(0)
  await expect(card(page, "clean").getByRole("button", { name: "Restore", exact: true })).toBeVisible()
})

test("a deck this device keeps no copy of shows its initial on grey", async ({ page }) => {
  await store(page, [first])
  await page.goto("/")
  await expect(card(page, first.name).locator("[data-deck-initial]")).toHaveText("R")
  await expect(card(page, first.name).locator("[data-thumb-paint]")).toHaveCount(0)
  await clickPreview(page, first.name)
  await expect(page).toHaveURL(/\/deck\/first$/)
})
