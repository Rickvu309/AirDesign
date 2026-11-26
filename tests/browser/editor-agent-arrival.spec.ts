import { expect, type Page } from "@playwright/test"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
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

test("typing in an arriving layer, zooming, dragging it, or asking for less motion ends the trace at once", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const canvas = page.locator("[data-slide-box]")
  const layer = page.locator("[data-agent-arrival]")
  const { call, runId } = await agentNote(stack, opened, "Agent note", 600)
  const more = async (text: string, y: number) => {
    const written = await call("edit_deck", {
      deck: opened.deck,
      base: (await saved(stack, opened)).rev,
      runId,
      changes: [note(opened.slide, text, y)],
    })
    expect(written.ok, JSON.stringify(written)).toBe(true)
    await expect(layer.locator("svg")).toHaveCount(1)
    return canvas.locator("[data-node]", { has: page.getByText(text, { exact: true }) }).last()
  }
  await expect(layer.locator("> *")).toHaveCount(0)

  const typed = await more("Typed note", 300)
  const box = await typed.boundingBox()
  if (box === null) throw new Error("the agent's note is not painted")
  await page.mouse.dblclick(box.x + 40, box.y + box.height / 2)
  await expect(layer.locator("> *")).toHaveCount(0)
  expect(await typed.evaluate((element) => element.getAnimations().length)).toBe(0)
  await page.keyboard.press("Escape")

  await more("Zoomed note", 100)
  await page.keyboard.press("Shift+0")
  await expect(layer.locator("> *")).toHaveCount(0)

  const dragged = await more("Dragged note", 450)
  const hold = await dragged.boundingBox()
  if (hold === null) throw new Error("the agent's note is not painted")
  await page.mouse.move(hold.x + 40, hold.y + hold.height / 2)
  await page.mouse.down()
  await page.mouse.move(hold.x + 140, hold.y + hold.height / 2 + 40, { steps: 4 })
  await expect(layer.locator("> *")).toHaveCount(0)
  await page.mouse.up()

  const calmed = await more("Calm note", 800)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(layer.locator("> *")).toHaveCount(0)
  expect(await calmed.evaluate((element) => element.getAnimations().length)).toBe(0)
})

test("an agent edit made while the editor was closed does not play when the deck opens again", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await page.goto("about:blank")
  await agentNote(stack, opened, "Agent note", 600)
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  let release = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route(`**${doomRoutes.since.path}`, async (route) => {
    await held
    await route.fallback()
  })
  await page.goto(`/s/${opened.deck}`)
  await page.locator("[data-editor-ready]").waitFor()
  await countMarks(page)
  release()
  await expect(page.locator("[data-slide-box]").getByText("Agent note", { exact: true })).toBeVisible()
  expect(await marksSeen(page)).toBe(0)
})

test("the texts Aira adds from the chat arrive traced on the canvas", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  const canvas = page.locator("[data-slide-box]")
  await countMarks(page)
  stack.aira(
    {
      name: "add-two-texts.sse",
      fill: { deck: opened.deck, base: String((await saved(stack, opened)).rev), slide: opened.slide },
    },
    { name: "added-two-texts.sse" },
  )
  await page
    .locator("[data-editor-panel]")
    .getByRole("textbox", { name: airaCopy.askAira })
    .fill("Add a summary and a note")
  await page.keyboard.press("Enter")
  await expect(canvas.getByText("Draft note", { exact: true })).toBeVisible()
  await expect.poll(() => marksSeen(page)).toBeGreaterThan(0)
})

test("the canvas goes to a slide an agent makes and traces what the agent writes on it, but stays put while the person types", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const canvas = page.locator("[data-slide-box]")
  const call = agentCall(stack, await connectClaudeCode(stack, opened.cookie))
  const slideWith = async (text: string, runId?: unknown) => {
    const made = await call("edit_deck", {
      deck: opened.deck,
      base: (await saved(stack, opened)).rev,
      ...(runId === undefined ? {} : { runId }),
      changes: [{ op: "slide", add: {} }],
    })
    expect(made.ok, JSON.stringify(made)).toBe(true)
    const slide = (made.added as readonly { id: string }[])[0]!.id
    const wrote = await call("edit_deck", {
      deck: opened.deck,
      base: (await saved(stack, opened)).rev,
      runId: made.runId,
      changes: [note(slide, text, 400)],
    })
    expect(wrote.ok, JSON.stringify(wrote)).toBe(true)
    return { slide, runId: made.runId }
  }

  await countMarks(page)
  const first = await slideWith("On the new slide")
  await expect(canvas.getByText("On the new slide", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(first.slide)))
  await expect.poll(() => marksSeen(page)).toBeGreaterThan(0)

  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  let release = () => {}
  const waited = new Promise<void>((resolve) => (release = resolve))
  await page.route(`**${doomRoutes.since.path}`, async (route) => {
    await waited
    await route.fallback()
  })
  const together = await slideWith("Both in one answer", first.runId)
  release()
  await expect(canvas.getByText("Both in one answer", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(together.slide)))
  await page.unroute(`**${doomRoutes.since.path}`)

  const stage = await page.locator("[data-slide-box]").boundingBox()
  if (stage === null) throw new Error("no slide on the canvas")
  await page.keyboard.press("r")
  await page.mouse.move(stage.x + 60, stage.y + 60)
  await page.mouse.down()
  await page.mouse.move(stage.x + 160, stage.y + 140, { steps: 3 })
  await slideWith("While drawing", first.runId)
  await expect(page.locator("[data-slide-thumb]").getByText("While drawing", { exact: true })).toHaveCount(1)
  await page.mouse.up()
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(together.slide)))
  await expect.poll(async () => (await saved(stack, opened)).children.get(together.slide as never)?.length).toBe(2)
  await page.keyboard.press("Escape")

  const box = await canvas.getByText("Both in one answer", { exact: true }).boundingBox()
  if (box === null) throw new Error("the agent's note is not painted")
  await page.mouse.dblclick(box.x + 20, box.y + box.height / 2)
  await page.keyboard.type("Mine ")
  await slideWith("Elsewhere", first.runId)
  await expect(page.locator("[data-slide-thumb]").getByText("Elsewhere", { exact: true })).toHaveCount(1)
  await expect(canvas.getByText("Elsewhere", { exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(together.slide)))
})

test("a slide an agent makes has its border traced as the canvas opens it", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  const layer = page.locator("[data-agent-arrival]")
  const call = agentCall(stack, await connectClaudeCode(stack, opened.cookie))
  const made = await call("edit_deck", {
    deck: opened.deck,
    base: (await saved(stack, opened)).rev,
    changes: [{ op: "slide", add: {} }],
  })
  expect(made.ok, JSON.stringify(made)).toBe(true)
  await expect(layer.locator("svg")).toHaveCount(1)
  const traced = await layer.locator("svg").evaluate((svg) => svg.firstElementChild!.getBoundingClientRect().width)
  const slide = await page.locator("[data-slide-box]").boundingBox()
  expect(traced).toBeGreaterThan((slide?.width ?? 0) - 8)
  expect(traced).toBeLessThanOrEqual(slide?.width ?? 0)
  await expect(layer.locator("> *")).toHaveCount(0)
})
