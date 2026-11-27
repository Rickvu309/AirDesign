import { scriptOf } from "../../packages/agent/src/testing/change-script.ts"
import { expect, type Page } from "@playwright/test"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
import { agentEditingMark } from "../../apps/web/src/copy/agent-runs-copy.ts"
import { editorCopy } from "../../apps/web/src/copy/editor-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { test } from "./api-stack"
import { agentCall, connectClaudeCode, saved } from "./claude-code"
import { openEditor } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" })

async function ask(page: Page, text: string) {
  await page.locator("[data-editor-panel]").getByRole("textbox", { name: airaCopy.askAira }).fill(text)
  await page.keyboard.press("Enter")
}

const note = (slide: string, text: string, y: number) => ({
  op: "insert",
  kind: "text",
  parent: slide,
  text,
  box: { x: 160, y, w: 800, h: 80 },
})

test("the mark shows while an agent writes, leaves after thirty quiet seconds with the run still open, and a late write continues the run", async ({
  page,
  context,
  stack,
}) => {
  await page.clock.install()
  const opened = await openEditor(page, context, stack)
  const side = page.locator("[data-editor-panel]")
  const canvas = page.locator("[data-slide-box]")
  const label = page.locator("[data-slide-label]")
  const mark = label.getByRole("button", { name: agentEditingMark(["Claude Code"], { here: true }) })
  const call = agentCall(stack, await connectClaudeCode(stack, opened.cookie))

  const first = await call("execute", {
    deck: opened.deck,
    script: scriptOf([note(opened.slide, "Agent note", 820)]),
  })
  expect(first.ok, JSON.stringify(first)).toBe(true)
  await expect(canvas.getByText("Agent note", { exact: true })).toBeVisible()
  await expect(mark).toBeVisible()
  await expect(side.getByText("Claude Code")).toHaveCount(0)

  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await expect(side.locator("[data-aira-panel]")).toBeHidden()
  await mark.click()
  await expect(side.locator("[data-aira-panel]")).toBeVisible()

  await page.clock.fastForward(31_000)
  await expect(label.locator("[data-agent-at-work]")).toHaveCount(0)
  expect((await saved(stack, opened)).runs.get(String(first.runId))?.phase).toBe("running")

  const late = await call("execute", {
    deck: opened.deck,
    runId: first.runId,
    script: scriptOf([note(opened.slide, "Late note", 700)]),
  })
  expect(late.ok, JSON.stringify(late)).toBe(true)
  await expect(canvas.getByText("Late note", { exact: true })).toBeVisible()
  await expect(mark).toBeVisible()
  expect((await saved(stack, opened)).runs.get(String(first.runId))).toMatchObject({ phase: "running" })
})

test("Undo in Aira's chat takes back only Aira's run, leaves another agent's work, and a reload keeps it", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const side = page.locator("[data-editor-panel]")
  const log = side.getByRole("log")
  const canvas = page.locator("[data-slide-box]")
  const call = agentCall(stack, await connectClaudeCode(stack, opened.cookie))
  const first = await call("execute", {
    deck: opened.deck,
    script: scriptOf([note(opened.slide, "Agent note", 820)]),
  })
  expect((await call("stop_run", { deck: opened.deck, runId: first.runId })).ok).toBe(true)
  await expect(canvas.getByText("Agent note", { exact: true })).toBeVisible()

  stack.aira(
    {
      name: "add-two-texts.sse",
      fill: { deck: opened.deck, base: String((await saved(stack, opened)).rev), slide: opened.slide },
    },
    { name: "added-two-texts.sse" },
  )
  await ask(page, "Add a summary and a note")
  await expect(canvas.getByText("Draft note", { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  const undo = side.getByRole("button", { name: productCopy.undo, exact: true })
  await expect(undo).toHaveCount(1)

  await log.getByRole("button", { name: productCopy.undo, exact: true }).click()
  await expect(canvas.getByText("Draft note", { exact: true })).toHaveCount(0)
  await expect(log.getByText(airaCopy.undone, { exact: true })).toBeVisible()
  await expect(canvas.getByText("Agent note", { exact: true })).toBeVisible()

  await page.locator("[data-canvas-stage]").focus()
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(canvas.getByText("Draft note", { exact: true })).toBeVisible()
  await undo.click()
  await expect(canvas.getByText("Draft note", { exact: true })).toHaveCount(0)

  await expect
    .poll(async () =>
      [...(await saved(stack, opened)).runs].map(([id, run]) => [id === first.runId, run.undone === true]),
    )
    .toEqual(
      expect.arrayContaining([
        [true, false],
        [false, true],
      ]),
    )
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await expect(undo).toHaveCount(0)
  await expect(canvas.getByText("Agent note", { exact: true })).toBeVisible()
  await expect(canvas.getByText("Draft note", { exact: true })).toHaveCount(0)
})
