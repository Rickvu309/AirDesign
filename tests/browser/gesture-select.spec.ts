import { expect, type Locator, type Page } from "@playwright/test"
import { forward, openClean, signInBrowser, test } from "./api-stack"
import { covers } from "./gesture"

const part = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1470, height: 923 } })

function frame(page: Page, node: string): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${node.split(".")[1] ?? ""}"]`)
}

function shapes(page: Page): Promise<string[]> {
  return page
    .locator("[data-slide-paint] [data-canvas-element]")
    .evaluateAll((nodes) => nodes.map((node) => `256.${node.getAttribute("data-canvas-element")?.split("#")[1] ?? ""}`))
}

test("Cmd or Ctrl+click adds a second shape, and when an agent deletes it the first keeps the selection", async ({
  page,
  context,
  stack,
}) => {
  covers("select-add")
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  const before = await shapes(page)
  for (const name of ["Rectangle", "Ellipse"]) {
    await page.getByRole("button", { name: "Shapes", exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
  }
  await expect.poll(async () => (await shapes(page)).length).toBe(before.length + 2)
  const [first, second] = (await shapes(page)).filter((node) => !before.includes(node))
  if (first === undefined || second === undefined) throw new Error("no shapes")
  await frame(page, first).click()
  await frame(page, second).click({ modifiers: ["ControlOrMeta"] })
  const selected = page.locator("[data-slide-paint] [data-selection]")
  const chosen = page.locator("[data-slide-paint] [data-chosen]")
  await expect(selected).toHaveAttribute("data-selection", second)
  await expect(chosen).toHaveAttribute("data-chosen", first)

  await expect
    .poll(async () => JSON.stringify(await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)))
    .toContain(second)
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  expect(await stack.callTool("airdesign_delete_element", { deck, base, node: second }, cookie)).toMatchObject({
    ok: true,
  })
  await expect(frame(page, second)).toHaveCount(0)
  await expect(selected).toHaveAttribute("data-selection", first)
  await expect(chosen).toHaveCount(0)
  const left = await frame(page, first).boundingBox()
  if (left === null) throw new Error("no shape left")
  await page.mouse.click(left.x + 10, left.y + 10, { button: "right" })
  await expect(page.getByRole("menuitem", { name: "Group Ctrl+G" })).toBeDisabled()
})
