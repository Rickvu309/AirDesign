import { expect, test } from "@playwright/test"
import { openDeck, placed } from "./design-panel"
import { shapeAt } from "./shape-fills"
import { shapePanel } from "./shape-turns"

test.use({ viewport: { width: 1470, height: 923 } })

const element = "ppt/slides/slide1.xml#2"

test("an action moves the element, is a button that never stays pressed, and names itself in a tooltip", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const panel = await shapePanel(page, shapeAt(page, "2"))
  const align = panel.getByRole("group", { name: "Align", exact: true })
  await expect(align.getByRole("button")).toHaveCount(6)
  await expect(align.getByRole("button").first()).toHaveAttribute("title", "Align left")
  await expect(panel.getByRole("group", { name: "Distribute", exact: true }).getByRole("button")).toHaveCount(2)

  const left = await placed(page, element)
  const center = align.getByRole("button", { name: "Align center", exact: true })
  await center.click()
  await expect.poll(() => placed(page, element)).not.toEqual(left)
  const centred = await placed(page, element)
  const middle = align.getByRole("button", { name: "Align middle", exact: true })
  await middle.click()
  await expect.poll(() => placed(page, element)).not.toEqual(centred)

  for (const button of await align.getByRole("button").all()) await expect(button).not.toHaveAttribute("aria-pressed")
  const moved = await placed(page, element)
  await align.getByRole("button", { name: "Align left", exact: true }).click()
  await expect.poll(async () => (await placed(page, element))[0]).not.toBe(moved[0])
  expect((await placed(page, element))[1]).toBe(moved[1])
  for (const button of await align.getByRole("button").all()) await expect(button).not.toHaveAttribute("aria-pressed")
})
