import { expect } from "@playwright/test"
import { forward, test } from "./api-stack"
import { accent, clickSlide, landNodes, openDoomEditor, savedNode, selectedIds, spot } from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

test("an undo of typing in a layer another tab deleted does nothing, and the next undo takes back the nudge below it", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  const boxOf = async (id: string) => (await savedNode(stack, opened, id))?.box as Box
  const charsOf = async (id: string) => ((await savedNode(stack, opened, id))?.text as { chars?: string })?.chars
  const title = await boxOf("s:4")
  const subtitle = await boxOf("s:5")
  const centre = (box: Box) => [box.x + box.w / 2, box.y + box.h / 2] as const

  await clickSlide(page, ...centre(subtitle))
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x + 1)
  await page.keyboard.press("Escape")
  await clickSlide(page, ...centre(title))
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await page.keyboard.type("Quarterly plan")
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-text-editor]")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect.poll(() => charsOf("s:4")).toContain("Quarterly plan")

  const other = await context.newPage()
  await forward(other, stack)
  await other.goto(`/s/${opened.deck}`)
  await other.locator("[data-doom-ready]").waitFor()
  await clickSlide(other, ...centre(title))
  await other.keyboard.press("Delete")
  await expect.poll(async () => (await savedNode(stack, opened, "s:4"))?.parent).toBeNull()
  const shownTitle = page.locator('[data-slide-box] [data-node="s:4"]')
  await expect(shownTitle).toHaveCount(0)

  await page.keyboard.press("ControlOrMeta+z")
  await expect(shownTitle).toHaveCount(0)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x)
  expect((await savedNode(stack, opened, "s:4"))?.parent).toBeNull()
  await other.close()
})

for (const above of [true, false])
  test(`an undo of framing a layer whose ${above ? "frame's frame" : "frame"} another tab deleted keeps the new frame, so their undo brings the layer back in it`, async ({
    page,
    context,
    stack,
  }) => {
    const opened = await openDoomEditor(page, context, stack)
    const card = [{ kind: "solid", color: { var: "accent4" } }]
    const gone = above ? "t:71" : "t:72"
    await landNodes(stack, opened, [
      ...(above
        ? [
            {
              id: "t:71",
              type: "frame" as const,
              parent: opened.slide,
              props: { box: spot(200, 200, 900, 600), fills: accent },
            },
          ]
        : []),
      {
        id: "t:72",
        type: "frame" as const,
        parent: above ? "t:71" : opened.slide,
        props: { box: above ? spot(100, 100, 600, 400) : spot(300, 300, 600, 400), fills: accent },
      },
      {
        id: "t:73",
        type: "shape",
        parent: "t:72",
        props: { box: spot(100, 100, 200, 100), geometry: { kind: "rect" }, fills: card },
      },
    ])
    const parentId = async (id: string) =>
      ((await savedNode(stack, opened, id))?.parent as { id: string } | null | undefined)?.id ?? null
    const shownCard = (tab: typeof page) => tab.locator('[data-slide-box] [data-node="t:73"]')
    await expect(shownCard(page)).toHaveCount(1)
    await page.keyboard.down("Control")
    await clickSlide(page, 500, 450)
    await page.keyboard.up("Control")
    await expect.poll(() => selectedIds(page)).toEqual(["t:73"])
    await page.keyboard.press("Control+Alt+g")
    await expect.poll(() => parentId("t:73")).not.toBe("t:72")
    const frame = (await parentId("t:73"))!
    const framed = (await savedNode(stack, opened, "t:73"))?.box
    expect(await parentId(frame)).toBe("t:72")

    const other = await context.newPage()
    await forward(other, stack)
    await other.goto(`/s/${opened.deck}`)
    await other.locator("[data-doom-ready]").waitFor()
    await clickSlide(other, 330, 330)
    await expect.poll(() => selectedIds(other)).toEqual([gone])
    await other.keyboard.press("Delete")
    await expect.poll(async () => (await savedNode(stack, opened, gone))?.parent).toBeNull()
    await expect(shownCard(page)).toHaveCount(0)

    await page.keyboard.press("ControlOrMeta+z")
    await other.keyboard.press("ControlOrMeta+z")
    await expect.poll(() => parentId(gone)).toBe(opened.slide)
    await expect(shownCard(page)).toHaveCount(1)
    await expect(shownCard(other)).toHaveCount(1)
    expect([await parentId("t:73"), await parentId(frame)]).toEqual([frame, "t:72"])
    expect((await savedNode(stack, opened, "t:73"))?.box).toEqual(framed)
    await other.close()
  })

test("a text box emptied and left goes in one step with its typing, and redo deletes it again after an undo", async ({
  page,
  context,
  stack,
}) => {
  await page.clock.install()
  const opened = await openDoomEditor(page, context, stack)
  const saved = () => savedNode(stack, opened, "s:4")
  const before = await saved()
  const box = before?.box as Box
  const shownTitle = page.locator('[data-slide-box] [data-node="s:4"]')

  await clickSlide(page, box.x + box.w / 2, box.y + box.h / 2)
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await page.keyboard.type("Draft")
  await page.clock.runFor(1000)
  await expect.poll(async () => ((await saved())?.text as { chars: string }).chars).toContain("Draft")
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Backspace")
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await saved())?.parent).toBeNull()
  await expect(shownTitle).toHaveCount(0)

  await page.keyboard.press("ControlOrMeta+z")
  await expect(shownTitle).toHaveCount(1)
  await expect.poll(async () => (await saved())?.text).toEqual(before?.text)

  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(shownTitle).toHaveCount(0)
  await expect.poll(async () => (await saved())?.parent).toBeNull()
})

test("a deck named by its title goes back to the default when the emptied title is deleted, and Undo and Redo keep the name with the title", async ({
  page,
  context,
  stack,
}) => {
  await page.clock.install()
  const opened = await openDoomEditor(page, context, stack)
  const deckName = async () => (await savedNode(stack, opened, "s:1"))?.name
  const before = await savedNode(stack, opened, "s:4")
  const title = before?.box as Box
  const shownTitle = page.locator('[data-slide-box] [data-node="s:4"]')
  const starting = await deckName()
  expect(starting).not.toBe("Draft")

  await clickSlide(page, title.x + title.w / 2, title.y + title.h / 2)
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await page.keyboard.type("Draft")
  await page.clock.runFor(1000)
  await expect.poll(deckName).toBe("Draft")
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Backspace")
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await savedNode(stack, opened, "s:4"))?.parent).toBeNull()
  await expect(shownTitle).toHaveCount(0)
  await expect.poll(deckName).toBe(starting)

  await page.keyboard.press("ControlOrMeta+z")
  await expect(shownTitle).toHaveCount(1)
  await expect.poll(async () => (await savedNode(stack, opened, "s:4"))?.text).toEqual(before?.text)
  await expect.poll(deckName).toBe(starting)

  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(shownTitle).toHaveCount(0)
  await expect.poll(deckName).toBe(starting)
})
