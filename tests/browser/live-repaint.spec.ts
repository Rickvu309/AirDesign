import { expect } from "@playwright/test"
import { forward, signInBrowser, test } from "./api-stack"

const node = "256.2"

function value(text: string): string {
  return JSON.stringify([{ from: 0, runs: [{ from: 0, text }] }])
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("slide revisions follow without reload, keep selection, and select a neighbor after removal", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  await page.evaluate(() => {
    document.body.dataset.sameLoad = "yes"
  })
  const rows = page.locator("[data-slide-entry]")
  const selected = page.locator('[data-slide-entry][aria-current="true"]')
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(rows).toHaveCount(2)
  await expect(selected).toHaveAttribute("data-slide-entry", "2")
  await expect.poll(async () => (await stack.post("/decks/open", { deck }, cookie)).json.revision).toBe(1)
  const { deckRoutes } = await import("../../packages/catalog/src/index.ts")
  const { slideCommand } = await import("../../apps/web/src/editing/slide-edit.ts")
  async function outside(change: "clone" | "move" | "remove", index: number, to = index) {
    const opened = deckRoutes.open.result((await stack.post(deckRoutes.open.path, { deck }, cookie)).json)
    if (!opened.ok) throw new Error("open")
    const command = slideCommand(
      { ...opened.register, file: opened.register.file ?? [], order: opened.register.order ?? [] },
      change,
      index,
      to,
    )
    if (command === null) throw new Error("command")
    expect(
      (
        await stack.post(
          deckRoutes.commit.path,
          { deck, batch: [{ ...command.edit, file: opened.register.file }] },
          cookie,
        )
      ).json,
    ).toMatchObject({ ok: true })
  }
  await outside("clone", 0)
  await expect(rows).toHaveCount(3)
  await expect(selected).toHaveAttribute("data-slide-entry", "3")
  await outside("move", 2, 0)
  await expect(selected).toHaveAttribute("data-slide-entry", "1")
  await outside("remove", 0)
  await expect(rows).toHaveCount(2)
  await expect(selected).toHaveAttribute("data-slide-entry", "1")
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await outside("remove", 1)
  await expect(rows).toHaveCount(1)
  expect(await page.evaluate(() => document.body.dataset.sameLoad)).toBe("yes")
})
