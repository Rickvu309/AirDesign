import { expect } from "@playwright/test"
import * as doom from "../../packages/doom/src/index.ts"
import { test } from "./api-stack"
import { accent, clickSlide, landNodes, openEditor, otherTab, savedNode, selectedIds, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

const blue = [{ kind: "solid", color: { var: "accent4" } }]

test("Ctrl+Z of the tab that grouped a layer, after the other tab nudged it, puts it back on the slide where the person sees it", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:81",
      type: "shape",
      parent: opened.slide,
      props: { box: spot(300, 300, 200, 100), geometry: { kind: "rect" }, fills: blue },
    },
  ])
  const boxOf = async () => (await savedNode(stack, opened, "t:81"))?.box as Box
  const parentOf = async () =>
    ((await savedNode(stack, opened, "t:81"))?.parent as { id: string } | null | undefined)?.id
  await expect(page.locator('[data-slide-box] [data-node="t:81"]')).toHaveCount(1)
  const other = await otherTab(context, stack, opened.deck)
  for (const tab of [page, other]) {
    await expect
      .poll(async () => {
        await clickSlide(tab, 400, 350)
        return selectedIds(tab)
      })
      .toEqual(["t:81"])
  }
  await other.keyboard.press("ControlOrMeta+g")
  await expect.poll(parentOf).not.toBe(opened.slide)
  const group = (await parentOf())!
  await expect(page.locator(`[data-node="${group}"] [data-node="t:81"]`).first()).toBeAttached()
  const grouped = await boxOf()
  const holder = (await savedNode(stack, opened, group))?.box as Box

  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await boxOf()).x).toBe(grouped.x + 1)
  await other.keyboard.press("ControlOrMeta+z")
  await expect.poll(parentOf).toBe(opened.slide)
  const seen = await boxOf()
  expect(seen).toMatchObject({ x: holder.x + grouped.x + 1, y: holder.y + grouped.y })

  await other.close()
})

test("Undo on an agent run that moved a layer out of its frame, after the person nudged it, puts it back in the frame where the person sees it", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:81", type: "frame", parent: opened.slide, props: { box: spot(100, 200, 500, 500), fills: accent } },
    {
      id: "t:83",
      type: "shape",
      parent: "t:81",
      props: { box: spot(100, 100, 200, 100), geometry: { kind: "rect" }, fills: blue, name: "Card" },
    },
  ])
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const author = { kind: "agent", id: "helper", run: "run-out" }
  const onTop = doom.orderKeyBetween(doom.orderKeyBetween(doom.orderKeyBetween(null, null), null), null)
  for (const edit of [
    {
      once: "out-1",
      author,
      phase: "start",
      writes: [
        { node: "t:83", prop: "parent", value: { id: opened.slide, at: onTop } },
        { node: "t:83", prop: "box", value: spot(200, 300, 200, 100) },
      ],
    },
    { once: "out-2", author, phase: "stop", writes: [] },
  ])
    expect((await stack.post(doomRoutes.edit.path, { deck: opened.deck, edit }, opened.cookie)).json.ok).toBe(true)
  const cardIn = async () => (await savedNode(stack, opened, "t:83")) as { parent: { id: string }; box: Box }
  await expect.poll(async () => (await cardIn()).parent.id).toBe(opened.slide)
  await expect(page.locator('[data-slide-box] [data-node="t:81"] [data-node="t:83"]')).toHaveCount(0)
  await expect(page.locator('[data-slide-box] [data-node="t:83"]')).toHaveCount(1)

  await clickSlide(page, 300, 350)
  await expect.poll(() => selectedIds(page)).toEqual(["t:83"])
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await cardIn()).box.x).toBe(201)

  await page.locator('[data-agent-run="run-out"] [data-agent-run-undo]').click()
  await expect.poll(async () => (await cardIn()).parent.id).toBe("t:81")
  expect((await cardIn()).box).toMatchObject({ x: 101, y: 100, w: 200, h: 100 })
})
