import { expect } from "@playwright/test"
import { linkCopy } from "../../apps/web/src/copy/link-copy"
import { test } from "./api-stack"
import { spot } from "./doom-deck"
import { designDoom, pick, reloadDesign, saved, section, typeInto, words } from "./doom-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a link saves a URL on the text, keeps it over a reload, refuses words that are not a URL, and an empty field removes it", async ({
  page,
  context,
  stack,
}) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    {
      id: "t:1",
      type: "shape",
      parent: slide,
      props: { box: spot(100, 100, 900, 160), text: words("Quarterly review") },
    },
  ])
  const link = async () => (await saved(stack, opened, "t:1")).link
  await pick(page, "t:1", 400, 180)
  const field = () => section(page, linkCopy.section).getByRole("textbox", { name: linkCopy.target, exact: true })
  await typeInto(field(), "https://example.com")
  await expect.poll(link).toBe("https://example.com")
  await reloadDesign(page)
  await pick(page, "t:1", 400, 180)
  await expect(field()).toHaveValue("https://example.com")

  await typeInto(field(), "not a link")
  await expect(field()).toHaveAttribute("aria-invalid", "true")
  expect(await link()).toBe("https://example.com")
  await typeInto(field(), "")
  await expect.poll(link).toBeUndefined()
  await expect(field()).toHaveValue("")
})

test("a link to a slide saves that slide by its number or from the menu, and shows its number over a reload", async ({
  page,
  context,
  stack,
}) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    {
      id: "t:1",
      type: "shape",
      parent: slide,
      props: { box: spot(100, 100, 900, 160), text: words("Quarterly review") },
    },
  ])
  const link = async () => (await saved(stack, opened, "t:1")).link
  await pick(page, "t:1", 400, 180)
  const linked = () => section(page, linkCopy.section)
  const field = () => linked().getByRole("textbox", { name: linkCopy.target, exact: true })
  await typeInto(field(), "1")
  await expect(field()).not.toHaveAttribute("aria-invalid")
  await expect.poll(link).toBe(opened.slide)
  await reloadDesign(page)
  await pick(page, "t:1", 400, 180)
  await expect(field()).toHaveValue("1")

  await typeInto(field(), "")
  await expect.poll(link).toBeUndefined()
  await linked().getByRole("button", { name: linkCopy.slides, exact: true }).click()
  await page.getByRole("menuitem", { name: `${linkCopy.slide} 1`, exact: true }).click()
  await expect.poll(link).toBe(opened.slide)
  await expect(field()).toHaveValue("1")
})
