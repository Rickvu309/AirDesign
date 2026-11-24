import { expect, type BrowserContext, type Page } from "@playwright/test"
import { agentLeftLayers } from "../../apps/web/src/copy/agent-runs-copy.ts"
import { airaKeptLayerName } from "../../apps/web/src/copy/aira-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import * as doom from "../../packages/doom/src/index.ts"
import { forward, test, type Stack } from "./api-stack"
import { accent, clickSlide, landNodes, openDoomEditor, savedNode, selectedIds, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

const blue = [{ kind: "solid", color: { var: "accent4" } }]

async function otherTab(context: BrowserContext, stack: Stack, deck: string): Promise<Page> {
  const other = await context.newPage()
  await forward(other, stack)
  await other.goto(`/s/${deck}`)
  await other.locator("[data-doom-ready]").waitFor()
  return other
}

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
  test(`an undo of framing a layer whose ${above ? "frame's frame another tab deleted puts it back unframed" : "frame another tab deleted keeps the new frame"}, so their undo brings the layer back`, async ({
    page,
    context,
    stack,
  }) => {
    const opened = await openDoomEditor(page, context, stack)
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
        props: { box: spot(100, 100, 200, 100), geometry: { kind: "rect" }, fills: blue },
      },
    ])
    const parentId = async (id: string) =>
      ((await savedNode(stack, opened, id))?.parent as { id: string } | null | undefined)?.id ?? null
    const shownCard = (tab: typeof page) => tab.locator('[data-slide-box] [data-node="t:73"]')
    await expect(shownCard(page)).toHaveCount(1)
    const placed = (await savedNode(stack, opened, "t:73"))?.box
    await page.keyboard.down("Control")
    await clickSlide(page, 500, 450)
    await page.keyboard.up("Control")
    await expect.poll(() => selectedIds(page)).toEqual(["t:73"])
    await page.keyboard.press("Control+Alt+g")
    await expect.poll(() => parentId("t:73")).not.toBe("t:72")
    const frame = (await parentId("t:73"))!
    const framed = (await savedNode(stack, opened, "t:73"))?.box
    expect(await parentId(frame)).toBe("t:72")

    const other = await otherTab(context, stack, opened.deck)
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
    expect([await parentId("t:73"), await parentId(frame)]).toEqual(above ? ["t:72", null] : [frame, "t:72"])
    expect((await savedNode(stack, opened, "t:73"))?.box).toEqual(above ? placed : framed)
    await other.close()
  })

for (const [whose, frame] of [
  ["frame's frame", "t:71"],
  ["own frame", "t:72"],
] as const)
  test(`an undo of deleting a layer whose ${whose} another tab deleted puts it back, so their undo brings it back with the frames`, async ({
    page,
    context,
    stack,
  }) => {
    const opened = await openDoomEditor(page, context, stack)
    await landNodes(stack, opened, [
      { id: "t:71", type: "frame", parent: opened.slide, props: { box: spot(200, 200, 900, 600), fills: accent } },
      { id: "t:72", type: "frame", parent: "t:71", props: { box: spot(100, 100, 600, 400), fills: blue } },
      {
        id: "t:73",
        type: "shape",
        parent: "t:72",
        props: { box: spot(100, 100, 200, 100), geometry: { kind: "rect" }, fills: blue },
      },
    ])
    const shownCard = (tab: Page) => tab.locator('[data-slide-box] [data-node="t:73"]')
    await expect(shownCard(page)).toHaveCount(1)
    await page.keyboard.down("Control")
    await clickSlide(page, 500, 450)
    await page.keyboard.up("Control")
    await expect.poll(() => selectedIds(page)).toEqual(["t:73"])
    await page.keyboard.press("Delete")
    await expect.poll(async () => (await savedNode(stack, opened, "t:73"))?.parent).toBeNull()

    const other = await otherTab(context, stack, opened.deck)
    if (frame === "t:72") await other.keyboard.down("Control")
    await clickSlide(other, 330, 330)
    await other.keyboard.up("Control")
    await expect.poll(() => selectedIds(other)).toEqual([frame])
    await other.keyboard.press("Delete")
    await expect.poll(async () => (await savedNode(stack, opened, frame))?.parent).toBeNull()

    await page.keyboard.press("ControlOrMeta+z")
    await expect
      .poll(async () => ((await savedNode(stack, opened, "t:73"))?.parent as { id: string } | null)?.id)
      .toBe("t:72")
    await expect(shownCard(page)).toHaveCount(0)
    await other.keyboard.press("ControlOrMeta+z")
    await expect.poll(async () => (await savedNode(stack, opened, frame))?.parent).not.toBeNull()
    await expect(shownCard(page)).toHaveCount(1)
    await expect(shownCard(other)).toHaveCount(1)
    await other.close()
  })

test("a reorder made offline of a layer another tab deleted, from the frame they deleted after it, is set aside, so each of their undos brings back one", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:91", type: "frame", parent: opened.slide, props: { box: spot(200, 200, 900, 600), fills: accent } },
    {
      id: "t:92",
      type: "shape",
      parent: "t:91",
      props: { box: spot(100, 100, 300, 200), geometry: { kind: "rect" }, fills: blue },
    },
    {
      id: "t:93",
      type: "shape",
      parent: "t:91",
      props: { box: spot(300, 200, 300, 200), geometry: { kind: "rect" }, fills: accent },
    },
  ])
  const parentId = async (id: string) =>
    ((await savedNode(stack, opened, id))?.parent as { id: string } | null | undefined)?.id ?? null
  const shownCard = (tab: Page) => tab.locator('[data-slide-box] [data-node="t:92"]')
  await expect(shownCard(page)).toHaveCount(1)
  const other = await otherTab(context, stack, opened.deck)

  let offline = true
  await page.route(
    (url) => url.pathname.startsWith("/doom/"),
    (route) => (offline ? route.abort("internetdisconnected") : route.fallback()),
  )
  await page.keyboard.down("Control")
  await clickSlide(page, 350, 350)
  await page.keyboard.up("Control")
  await expect.poll(() => selectedIds(page)).toEqual(["t:92"])
  await page.keyboard.press("BracketRight")
  await expect(page.locator("[data-save-status]")).not.toHaveText(productCopy.saved)

  await other.keyboard.down("Control")
  await clickSlide(other, 350, 350)
  await other.keyboard.up("Control")
  await expect.poll(() => selectedIds(other)).toEqual(["t:92"])
  await other.keyboard.press("Delete")
  await expect.poll(() => parentId("t:92")).toBeNull()
  await clickSlide(other, 1000, 700)
  await expect.poll(() => selectedIds(other)).toEqual(["t:91"])
  await other.keyboard.press("Delete")
  await expect.poll(() => parentId("t:91")).toBeNull()

  offline = false
  await expect(page.getByText(productCopy.editSetAside, { exact: true })).toBeVisible({ timeout: 15_000 })
  expect(await parentId("t:92")).toBeNull()

  await other.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => parentId("t:91")).toBe(opened.slide)
  expect(await parentId("t:92")).toBeNull()
  await expect(shownCard(other)).toHaveCount(0)
  await expect(shownCard(page)).toHaveCount(0)
  await other.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => parentId("t:92")).toBe("t:91")
  await expect(shownCard(other)).toHaveCount(1)
  await expect(shownCard(page)).toHaveCount(1)
  await other.close()
})

test("Undo on an agent run puts back the colour of a layer it leaves in the frame the run moved it to, and says why it stays", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:81", type: "frame", parent: opened.slide, props: { box: spot(100, 200, 500, 500), fills: accent } },
    { id: "t:82", type: "frame", parent: opened.slide, props: { box: spot(800, 200, 500, 500), fills: accent } },
    {
      id: "t:83",
      type: "shape",
      parent: "t:81",
      props: { box: spot(100, 100, 200, 100), geometry: { kind: "rect" }, fills: blue, name: "Card" },
    },
  ])
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const opening = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const base = doom.readFold(opening.json.fold)?.revs.get(doom.nodeId("t:83"))?.get("fills")
  const author = { kind: "agent", id: "helper", run: "run-card" }
  const red = [{ kind: "solid", color: { var: "accent2" } }]
  for (const edit of [
    {
      once: "card-1",
      author,
      phase: "start",
      writes: [
        { node: "t:83", prop: "parent", value: { id: "t:82", at: "a0" } },
        { node: "t:83", prop: "fills", value: red, base },
      ],
    },
    { once: "card-2", author, phase: "stop", writes: [] },
  ])
    expect((await stack.post(doomRoutes.edit.path, { deck: opened.deck, edit }, opened.cookie)).json.ok).toBe(true)
  await expect.poll(async () => (await savedNode(stack, opened, "t:83"))?.fills).toEqual(red)

  const other = await otherTab(context, stack, opened.deck)
  await clickSlide(other, 130, 230)
  await expect.poll(() => selectedIds(other)).toEqual(["t:81"])
  await other.keyboard.press("Delete")
  await expect.poll(async () => (await savedNode(stack, opened, "t:81"))?.parent).toBeNull()

  const row = page.locator('[data-agent-run="run-card"]')
  await row.locator("[data-agent-run-undo]").click()
  await expect.poll(async () => (await savedNode(stack, opened, "t:83"))?.fills).toEqual(blue)
  expect(((await savedNode(stack, opened, "t:83"))?.parent as { id: string }).id).toBe("t:82")
  await expect(row.locator("[data-agent-run-note]")).toHaveText(agentLeftLayers([airaKeptLayerName("Card")]))
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
