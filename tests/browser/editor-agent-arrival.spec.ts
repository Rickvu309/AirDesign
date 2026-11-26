import { expect, type Page } from "@playwright/test"
import { test, type Stack } from "./api-stack"
import { agentCall, connectClaudeCode, saved } from "./claude-code"
import { openEditor, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1440, height: 900 } })

const note = (slide: string, text: string, y: number) => ({
  op: "add",
  kind: "text",
  slide,
  text,
  box: { x: 160, y, w: 1200, h: 80 },
})

async function countMarks(page: Page) {
  await page.evaluate(() => {
    const layer = document.querySelector("[data-agent-arrival]")
    if (layer === null) throw new Error("no arrival layer on the canvas")
    const seen = { marks: 0 }
    new MutationObserver((changes) => {
      seen.marks += changes.reduce((sum, change) => sum + change.addedNodes.length, 0)
    }).observe(layer, { childList: true })
    Object.assign(window, { arrivalMarks: seen })
  })
}

const marksSeen = (page: Page) =>
  page.evaluate(() => (window as unknown as { arrivalMarks: { marks: number } }).arrivalMarks.marks)

async function agentNote(stack: Stack, opened: Opened, text: string, y: number) {
  const call = agentCall(stack, await connectClaudeCode(stack, opened.cookie))
  const written = await call("edit_deck", {
    deck: opened.deck,
    base: (await saved(stack, opened)).rev,
    changes: [note(opened.slide, text, y)],
  })
  expect(written.ok, JSON.stringify(written)).toBe(true)
  return { call, runId: written.runId }
}

test("an agent's new text arrives traced around its painted words, then leaves the canvas exactly as saved", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const canvas = page.locator("[data-slide-box]")
  const layer = page.locator("[data-agent-arrival]")
  await countMarks(page)
  await agentNote(stack, opened, "Agent note", 600)
  const words = canvas.locator("[data-node]", { has: page.getByText("Agent note", { exact: true }) }).last()
  await expect(layer.locator("svg")).toHaveCount(1)
  const traced = await layer.locator("svg").evaluate((svg) => svg.firstElementChild!.getBoundingClientRect().width)
  const box = await words.boundingBox()
  expect(traced).toBeGreaterThan(0)
  expect(traced).toBeLessThan((box?.width ?? 0) / 2)
  expect(await words.evaluate((element) => element.getAnimations().length)).toBe(1)

  await expect(layer.locator("> *")).toHaveCount(0)
  expect(await words.evaluate((element) => element.getAnimations().length)).toBe(0)
  expect(await words.evaluate((element) => getComputedStyle(element).opacity)).toBe("1")
  expect(await marksSeen(page)).toBe(1)
})

test("a person's own edit during an open agent run, and any agent edit under reduced motion, show no motion", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const canvas = page.locator("[data-slide-box]")
  const layer = page.locator("[data-agent-arrival]")
  const { call, runId } = await agentNote(stack, opened, "Agent note", 600)
  await expect(canvas.getByText("Agent note", { exact: true })).toBeVisible()
  await expect(layer.locator("> *")).toHaveCount(0)

  await countMarks(page)
  const box = await canvas.getByText("Agent note", { exact: true }).boundingBox()
  if (box === null) throw new Error("the agent's note is not painted")
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const before = (await saved(stack, opened)).rev
  await page.keyboard.press("ArrowDown")
  await expect.poll(async () => (await saved(stack, opened)).rev).toBeGreaterThan(before)
  expect((await saved(stack, opened)).runs.get(String(runId))?.phase).toBe("running")
  expect(await marksSeen(page)).toBe(0)

  await page.emulateMedia({ reducedMotion: "reduce" })
  const late = await call("edit_deck", {
    deck: opened.deck,
    base: (await saved(stack, opened)).rev,
    runId,
    changes: [note(opened.slide, "Quiet note", 300)],
  })
  expect(late.ok, JSON.stringify(late)).toBe(true)
  const quiet = canvas.locator("[data-node]", { has: page.getByText("Quiet note", { exact: true }) }).last()
  await expect(quiet).toBeVisible()
  expect(await quiet.evaluate((element) => element.getAnimations().length)).toBe(0)
  expect(await marksSeen(page)).toBe(0)
})
