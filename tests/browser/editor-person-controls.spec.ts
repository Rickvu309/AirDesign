import { expect, type Page } from "@playwright/test"
import * as doom from "../../packages/doom/src/index.ts"
import { compileIntents, placement, starts } from "../../packages/doom/src/testing/index.ts"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { textCopy, textWords } from "../../apps/web/src/copy/text-copy"
import { test, type Stack } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, landNodes, openEditor, savedNode, spot, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const catalog = () => import("../../packages/catalog/src/index.ts")

async function agentWrites(stack: Stack, opened: Opened, changes: readonly doom.Intent[]) {
  const { doomRoutes } = await catalog()
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const before = doom.readFold(answer.json.fold)
  if (before === undefined) throw new Error("no deck")
  let minted = 0
  const compiled = compileIntents(before, changes, {
    placement,
    starts,
    author: { kind: "agent", id: "aira", run: "run" },
    once: "agent",
    phase: "start",
    mint: () => doom.nodeId(`a:${(minted += 1)}`),
  })
  if ("refused" in compiled) throw new Error(JSON.stringify(compiled))
  return compiled.edit.writes
}

const agentValue = (writes: readonly doom.Write[], node: string, prop: string) =>
  writes.find((write) => write.node === node && write.prop === prop)?.value

const panelOf = (page: Page) => page.locator("[data-design-panel]")
const openDesign = (page: Page) => page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()

test("a person skips a slide, the saved value is the agent's, and one undo reverts it", async ({
  page,
  context,
  stack,
}) => {
  covers("undo")
  const faults: string[] = []
  page.on("pageerror", (error) => faults.push(error.message))
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await page.locator('[data-slide-entry="1"]').click()
  const saved = () => savedNode(stack, opened, opened.slide)

  const skip = await agentWrites(stack, opened, [{ op: "set", target: opened.slide, skipped: true }])
  await page.locator('[data-slide-entry="1"]').click({ button: "right" })
  await page.getByRole("menuitem", { name: slideListCopy.skip }).click()
  await expect(page.locator('[data-slide-entry="1"]')).toHaveAttribute("data-slide-skipped", "true")
  await expect.poll(async () => (await saved())?.skipped).toBe(agentValue(skip, opened.slide, "skipped"))
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator('[data-slide-entry="1"]')).not.toHaveAttribute("data-slide-skipped", "true")
  await expect.poll(async () => (await saved())?.skipped).not.toBe(true)

  expect(faults).toEqual([])
})

test("a person sets vertical align, the saved text is the agent's, and one undo reverts it", async ({
  page,
  context,
  stack,
}) => {
  covers("undo")
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(200, 600, 800, 300),
        text: { chars: "Hello there", spans: [], paras: [{}], style: "body", resize: "fixed", alignV: "top" },
      },
    },
  ])
  const text = async () => (await savedNode(stack, opened, "t:1"))?.text as { alignV: string; paras: object[] }
  await clickSlide(page, 300, 640)
  await openDesign(page)
  const panel = panelOf(page)

  const align = await agentWrites(stack, opened, [{ op: "set", target: "t:1", alignV: "bottom" }])
  await panel
    .getByLabel(textCopy.alignV, { exact: true })
    .getByRole("button", { name: textWords["alignV.bottom"] })
    .click()
  await expect.poll(text).toEqual(agentValue(align, "t:1", "text"))
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await text()).alignV).toBe("top")
})
