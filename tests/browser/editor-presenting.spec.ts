import { expect, type Page } from "@playwright/test"
import { connectionCopy } from "../../apps/web/src/copy/connection-copy"
import { placeholderRoles } from "../../apps/web/src/copy/placeholder-copy"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { accent, landNodes, openDoomEditor, savedNode, savedSlides, spot, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const shown = (page: Page) => page.locator("[data-present-show] [data-present-slide]")
const current = (page: Page) => page.locator('[data-slide-entry][aria-current="true"]')
const notes = (page: Page) => page.locator("[data-notes-bar] textarea")
const presentButton = (page: Page) => page.getByRole("button", { name: presentCopy.present, exact: true })

async function deckOfSlides(
  page: Page,
  context: Parameters<typeof openDoomEditor>[1],
  stack: Parameters<typeof openDoomEditor>[2],
  count: number,
) {
  const opened = await openDoomEditor(page, context, stack)
  for (let made = 1; made < count; made += 1) {
    await page.getByRole("button", { name: slideListCopy.addSlide }).click()
    await expect(page.locator("[data-slide-entry]")).toHaveCount(made + 1)
  }
  await expect.poll(async () => (await savedSlides(stack, opened)).length).toBe(count)
  return opened
}

async function noteOn(
  page: Page,
  stack: Parameters<typeof openDoomEditor>[2],
  opened: Opened,
  slide: number,
  text: string,
) {
  await page.locator(`[data-slide-entry="${String(slide)}"]`).click()
  await notes(page).fill(text)
  const id = (await savedSlides(stack, opened))[slide - 1] ?? ""
  await expect
    .poll(async () => ((await savedNode(stack, opened, id))?.notes as { chars: string } | undefined)?.chars)
    .toBe(text)
}

test("F5 starts the show on the first slide of a Doom deck, the show keys step through it and Esc lands on the slide it stopped on", async ({
  page,
  context,
  stack,
}) => {
  covers(
    "present",
    "show-next",
    "show-previous",
    "show-number",
    "show-go",
    "show-erase",
    "show-last",
    "show-first",
    "show-stop",
  )
  const faults: string[] = []
  page.on("pageerror", (error) => faults.push(error.message))
  const opened = await deckOfSlides(page, context, stack, 5)
  await page.locator('[data-slide-entry="3"]').click()
  await expect(current(page)).toHaveAttribute("data-slide-entry", "3")

  await page.keyboard.press("F5")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "1")
  await expect(shown(page)).toContainText(placeholderRoles.subTitle)
  const box = await shown(page).boundingBox()
  expect(box?.width).toBeGreaterThan(1500)
  expect(await page.locator("[data-doom-editor]").evaluate((node: HTMLElement) => node.inert)).toBe(true)

  for (const [key, slide] of [
    ["ArrowRight", "2"],
    [shortcutCopy.keyNames.Space, "3"],
    ["ArrowLeft", "2"],
    ["PageDown", "3"],
    ["PageUp", "2"],
    ["ArrowDown", "3"],
    ["ArrowUp", "2"],
    ["n", "3"],
  ] as const) {
    await page.keyboard.press(key)
    await expect(shown(page)).toHaveAttribute("data-present-slide", slide)
  }

  await page.keyboard.press("4")
  await expect(page.locator("[data-present-go-to]")).toHaveText(/Go to slide 4/)
  await page.keyboard.press("Backspace")
  await expect(page.locator("[data-present-go-to]")).toHaveCount(0)
  await page.keyboard.press("2")
  await page.keyboard.press("Enter")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "2")
  await page.keyboard.press("5")
  await page.keyboard.press("Enter")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "5")

  await page.keyboard.press("Home")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "1")
  await page.keyboard.press("End")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "5")
  await page.keyboard.press(connectionCopy.end)
  await expect(shown(page)).toHaveAttribute("data-present-slide", "5")
  await page.keyboard.press("ArrowRight")
  await expect(page.locator("[data-present-show]")).toContainText(presentCopy.end)
  await page.keyboard.press("ArrowLeft")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "5")
  await page.keyboard.press("ArrowLeft")
  await page.keyboard.press("ArrowLeft")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "3")
  await page.keyboard.press("Escape")

  await expect(page.locator("[data-present-show]")).toHaveCount(0)
  await expect(current(page)).toHaveAttribute("data-slide-entry", "3")
  await expect(presentButton(page)).toBeFocused()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(5)
  expect(await savedSlides(stack, opened)).toHaveLength(5)
  expect(faults).toEqual([])
})

test("Ctrl+Enter shows from the current slide, p opens the presenter view with notes, the next slide and the time", async ({
  page,
  context,
  stack,
}) => {
  covers("present-here", "show-presenter", "show-stop")
  const faults: string[] = []
  page.on("pageerror", (error) => faults.push(error.message))
  const opened = await deckOfSlides(page, context, stack, 3)
  await noteOn(page, stack, opened, 3, "Lead with the trend, then the number.")
  await page.locator('[data-slide-entry="2"]').click()
  await expect(current(page)).toHaveAttribute("data-slide-entry", "2")
  await page.locator("[data-editor-canvas]").click({ position: { x: 5, y: 5 } })

  await page.keyboard.press("ControlOrMeta+Enter")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "2")
  await page.keyboard.press("p")

  const presenter = page.locator("[data-presenter-view]")
  await expect(presenter).toContainText("Slide 2 of 3")
  await expect(presenter.locator('[data-present-slide="next-3"]')).toBeVisible()
  await expect(presenter.locator("[data-present-timer]")).toHaveText(/^00:0\d$/)
  await page.getByRole("button", { name: presentCopy.next }).click()
  await expect(presenter).toContainText("Slide 3 of 3")
  await expect(presenter.locator("[data-present-notes]")).toContainText("Lead with the trend, then the number.")
  await page.getByRole("button", { name: presentCopy.stop }).click()

  await expect(presenter).toHaveCount(0)
  await expect(current(page)).toHaveAttribute("data-slide-entry", "3")
  expect(faults).toEqual([])
})

test("Shift+F5 shows from the current slide and p switches between the audience view and the presenter view", async ({
  page,
  context,
  stack,
}) => {
  covers("present-here", "show-presenter", "show-stop")
  await deckOfSlides(page, context, stack, 3)
  await page.locator('[data-slide-entry="3"]').click()
  await page.keyboard.press("Shift+F5")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "3")
  await page.keyboard.press("p")
  await expect(page.locator("[data-presenter-view]")).toHaveCount(1)
  await page.keyboard.press("p")
  await expect(page.locator("[data-presenter-view]")).toHaveCount(0)
  await expect(shown(page)).toHaveAttribute("data-present-slide", "3")
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-present-show]")).toHaveCount(0)
  await expect(current(page)).toHaveAttribute("data-slide-entry", "3")
})

test("a click on a linked layer or linked words in the show follows the link, and a click elsewhere steps on", async ({
  page,
  context,
  stack,
}) => {
  const opened = await deckOfSlides(page, context, stack, 3)
  const [first, , third] = await savedSlides(stack, opened)
  await landNodes(stack, opened, [
    {
      id: "k:1",
      type: "shape",
      parent: first!,
      props: { box: spot(150, 800, 400, 150), fills: accent, link: third },
    },
    { id: "k:3", type: "shape", parent: first!, props: { box: spot(450, 820, 300, 100), fills: accent } },
    { id: "k:4", type: "shape", parent: first!, props: { box: spot(1000, 850, 300, 100), fills: accent, link: "z:9" } },
    {
      id: "k:2",
      type: "shape",
      parent: first!,
      props: {
        box: spot(1000, 600, 700, 120),
        text: {
          chars: "Read the site",
          spans: [{ end: 9 }, { end: 13, link: "https://example.com/" }],
          paras: [{}],
          style: "body",
          resize: "fixed",
          alignV: "top",
        },
      },
    },
  ])
  await page.locator('[data-slide-entry="1"]').click()
  await page.keyboard.press("F5")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "1")
  const run = (selector: string) =>
    page
      .locator(`[data-present-show] [data-node="k:2"] ${selector}`)
      .filter({ visible: true })
      .evaluate((node) => getComputedStyle(node).textDecorationLine)
  expect(await run('[data-link="https://example.com/"]')).toBe("underline")
  expect(await run("[data-run]:not([data-link])")).toBe("none")
  await page.locator('[data-present-show] [data-node="k:1"]').filter({ visible: true }).click({ force: true })
  await expect(shown(page)).toHaveAttribute("data-present-slide", "3")
  await page.keyboard.press("Home")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "1")
  await context.route("https://example.com/**", (route) => route.fulfill({ body: "linked" }))
  const popup = context.waitForEvent("page")
  await page
    .locator('[data-present-show] [data-link="https://example.com/"]')
    .filter({ visible: true })
    .click({ force: true })
  expect((await popup).url()).toBe("https://example.com/")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "1")
  await page
    .locator('[data-present-show] [data-node="k:3"]')
    .filter({ visible: true })
    .click({ position: { x: 10, y: 10 }, force: true })
  await expect(shown(page)).toHaveAttribute("data-present-slide", "2")
  await page.keyboard.press("Home")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "1")
  await page.locator('[data-present-show] [data-node="k:4"]').filter({ visible: true }).click({ force: true })
  await expect(shown(page)).toHaveAttribute("data-present-slide", "2")
  await page.keyboard.press("Home")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "1")
  await page
    .locator('[data-present-show] [data-node="k:2"]')
    .filter({ visible: true })
    .click({ position: { x: 5, y: 5 }, force: true })
  await expect(shown(page)).toHaveAttribute("data-present-slide", "2")
})
