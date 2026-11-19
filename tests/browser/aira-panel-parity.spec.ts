import { expect, type Page } from "@playwright/test"
import { forward, indexed, openClean, signInBrowser, test } from "./api-stack"
import { openScreen } from "./open-screen"

const node = "256.2"
const asked = "Change the title to Hello from Aira"

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

type PanelRegions = {
  readonly head: Box
  readonly headControl: Box
  readonly composer: Box
  readonly asked: Box | null
  readonly stop: Box | null
  readonly step: Box | null
}

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce", locale: "en-US" })

async function panelRegions(page: Page, step: string | null): Promise<PanelRegions> {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  return page.evaluate((step) => {
    const panel = document.querySelector("[data-editor-panel]")
    if (panel === null) throw new Error("missing panel")
    const box = (element: Element | null | undefined) => {
      if (element === null || element === undefined) return null
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height }
    }
    const sure = (element: Element | null | undefined) => {
      const found = box(element)
      if (found === null) throw new Error("missing region")
      return found
    }
    const head = panel.querySelector('[data-slot="conversation-head"]')
    const title =
      step === null
        ? null
        : [...panel.querySelectorAll("span")].find((span) => span.textContent === step && span.children.length === 0)
    return {
      head: sure(head),
      headControl: sure(head?.lastElementChild?.lastElementChild),
      composer: sure(panel.querySelector('[data-slot="prompt-input"]')),
      asked: box(panel.querySelector('[data-role="user"] > div')),
      stop: box(panel.querySelector('button[aria-label="Stop"]')),
      step: box(
        title?.previousElementSibling?.matches("[data-step-mark]") === true ? title.previousElementSibling : title,
      ),
    }
  }, step)
}

function near(actual: Box | null, expected: Box | null, name: string, keys: readonly (keyof Box)[]) {
  if (actual === null || expected === null) throw new Error(`missing ${name}`)
  for (const key of keys) {
    expect(
      Math.abs(actual[key] - expected[key]),
      `${name} ${key}: ${actual[key]} against ${expected[key]}`,
    ).toBeLessThanOrEqual(1)
  }
}

const whole = ["x", "y", "width", "height"] as const

function sameFrame(real: PanelRegions, design: PanelRegions) {
  near(real.head, design.head, "conversation head", whole)
  near(real.headControl, design.headControl, "new chat", whole)
  near(real.composer, design.composer, "composer", whole)
}

test("the real Agent panel keeps the designed head, composer, message and step rows in every state", async ({
  page,
  context,
  stack,
}) => {
  await openScreen(page, "/screens/s42-01-editor-agent-working")
  const designWorking = await panelRegions(page, "Building slide 3 of 8")
  await openScreen(page, "/screens/s42-02-editor-agent-run-complete")
  const designDone = await panelRegions(page, "Read 1 file, built 8 slides")

  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  await indexed(stack, deck, cookie)
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const empty = await panelRegions(page, null)
  sameFrame(empty, designDone)

  let open = () => undefined as void
  const gate = new Promise<void>((resolve) => {
    open = resolve
  })
  await page.route(
    (url) => url.pathname === stack.mcp,
    async (route) => {
      await gate
      await route.fallback()
    },
  )
  stack.aira({ name: "edit.sse", fill: { deck, base: String(base), node } }, { name: "edited.sse" })
  const side = page.locator("[data-editor-panel]")
  await side.getByRole("textbox", { name: "Ask Aira" }).fill(asked)
  await page.keyboard.press("Enter")
  await expect(side.locator('[data-tool-state="working"]')).toHaveText("Editing slides")
  const working = await panelRegions(page, "Editing slides")
  sameFrame(working, designWorking)
  near(working.stop, designWorking.stop, "Stop", whole)
  near(working.asked, designWorking.asked, "asked", ["y"])
  if (working.asked === null || designWorking.asked === null) throw new Error("missing asked")
  expect(
    Math.abs(working.asked.x + working.asked.width - (designWorking.asked.x + designWorking.asked.width)),
  ).toBeLessThanOrEqual(1)
  near(working.step, designWorking.step, "running step", ["x"])

  open()
  await expect(side.getByText("The title now reads Hello from Aira.", { exact: true })).toBeVisible()
  const done = await panelRegions(page, "Edited slides")
  sameFrame(done, designDone)
  near(done.step, designDone.step, "steps row", ["x"])
})
