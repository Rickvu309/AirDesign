import { expect } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { textCopy } from "../../apps/web/src/copy/text-copy"
import { test } from "./api-stack"
import { spot } from "./editor-deck"
import { designDoom, panel, pick, saved, undoOnStage, words } from "./editor-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a text style names the style, writes it to the text, and Undo puts the body style back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    {
      id: "t:1",
      type: "shape",
      parent: slide,
      props: { box: spot(100, 100, 1400, 200), text: words("Quarterly review") },
    },
  ])
  const style = async () => (await saved(stack, opened, "t:1")).text.style
  await pick(page, "t:1", 400, 180)
  const styles = panel(page).getByRole("combobox", { name: textCopy.style, exact: true })
  await expect(styles).toContainText(editorCopy.textStyles.body)
  await styles.click()
  const options = page.getByRole("option")
  await expect(options).toHaveCount(Object.keys(editorCopy.textStyles).length)
  const sizes = await options.evaluateAll((rows) => rows.map((row) => getComputedStyle(row).fontSize))
  expect(new Set(sizes).size).toBe(1)
  const chosen = page.getByRole("option", { selected: true })
  const check = await chosen.locator("svg").boundingBox()
  const name = await chosen.getByText(editorCopy.textStyles.body).first().boundingBox()
  expect(check!.x).toBeLessThan(name!.x)
  const inks = await options.evaluateAll((rows) =>
    rows.map((row) => getComputedStyle(row.querySelector("span span")!).color),
  )
  expect(new Set(inks).size).toBe(1)
  const menu = await page.getByRole("listbox").boundingBox()
  const field = await styles.boundingBox()
  expect(Math.abs(menu!.x - field!.x)).toBeLessThan(2)
  expect(Math.abs(menu!.width - field!.width)).toBeLessThan(2)
  await page.getByRole("option", { name: new RegExp(`^${editorCopy.textStyles.title}`) }).click()
  await expect.poll(style).toBe("title")
  await expect(styles).toContainText(editorCopy.textStyles.title)
  await undoOnStage(page)
  await expect.poll(style).toBe("body")
})
