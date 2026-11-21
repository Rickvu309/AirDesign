import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { openDeck, unfold } from "./design-panel"
import { shapeAt } from "./shape-fills"
import { keptWait, keptWaitApproval } from "./kept-wait"

test.use({ viewport: { width: 1600, height: 1000 } })

type Counted = Window & { renders?: number }

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const counted = window as Counted
    counted.renders = 0
    Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
      value: {
        supportsFiber: true,
        inject: () => 1,
        onCommitFiberRoot: () => {
          counted.renders = (counted.renders ?? 0) + 1
        },
        onCommitFiberUnmount: () => undefined,
      },
    })
  })
})

function renders(page: Page): Promise<number> {
  return page.evaluate(() => (window as Counted).renders ?? 0)
}

async function rendersWhile(page: Page, ms: number): Promise<number> {
  const before = await renders(page)
  await page.waitForTimeout(
    keptWait(ms, {
      why: "measures that the editor renders nothing for a span after the last key: the quiet span is what the test measures",
      until: "2027-02-18",
      approval: keptWaitApproval,
    }),
  )
  return (await renders(page)) - before
}

test("the editor stops rendering within a second of the last key typed fast into a two-column box with the Design panel open", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await shape.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  await unfold(panel, "Text box")
  const count = panel.getByRole("textbox", { name: "Columns", exact: true })
  await count.fill("2")
  await count.press("Enter")
  await expect(count).toHaveValue("2")

  await shape.locator('[contenteditable="true"]').focus()
  await page.keyboard.press("Control+End")
  const typed = ` ${"The quick brown fox jumps over the lazy dog while the team writes more. ".repeat(8)}`
  await page.keyboard.type(typed)
  const typing = await renders(page)
  await expect.poll(() => rendersWhile(page, 250), { timeout: 1_000, intervals: [0] }).toBe(0)
  expect(await renders(page)).toBeLessThan(typing + 30)
  await expect(page.getByRole("button", { name: "Undo text edit", exact: true })).toBeEnabled()
  await expect(shape).toContainText(typed.trim())
})
