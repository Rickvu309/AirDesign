import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const sectioned = join(process.cwd(), "scripts/pptx-fixtures/sections-before.pptx")
const clean = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")
const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as {
  readonly ZipReader: new (reader: unknown) => {
    getEntries(): Promise<{ filename: string; getData(writer: unknown): Promise<Uint8Array> }[]>
    close(): Promise<void>
  }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}
const designed = "/screens/s42-02-editor-agent-run-complete"

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
type Look = Readonly<Record<string, string>>

type Section = {
  readonly head: Box
  readonly name: Box
  readonly nameLook: Look
  readonly chevron: Box
  readonly pill: Box | null
  readonly pillLook: Look | null
  readonly stack: Box | null
  readonly bars: readonly Box[]
}

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

async function open(page: Page, file: string): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
  await expect(page.locator("[data-slide-entry='1'] [data-thumb-paint]")).toBeVisible()
}

async function sections(page: Page): Promise<readonly Section[]> {
  await page.evaluate(async () => {
    await document.fonts.load('13px "Geist Variable"')
    await document.fonts.ready
  })
  return page.evaluate(() => {
    const box = (element: Element | null | undefined) => {
      if (element === null || element === undefined) throw new Error("missing region")
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height }
    }
    const look = (element: Element, names: readonly string[]) => {
      const style = getComputedStyle(element)
      return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]))
    }
    const sidebar = box(document.querySelector("[data-editor-sidebar]"))
    const inside = (value: ReturnType<typeof box>) => ({
      ...value,
      x: value.x - sidebar.x,
      y: value.y - sidebar.y,
    })
    return [...document.querySelectorAll("[data-section-head]")].map((head) => {
      const parts = [...head.children]
      const pill = parts[2]
      const next = head.nextElementSibling
      const stack = next?.hasAttribute("data-section-stack") ? next : null
      const column = stack?.firstElementChild
      return {
        head: inside(box(head)),
        name: inside(box(parts[1])),
        nameLook: look(parts[1] as Element, ["font-size", "font-weight", "color", "line-height"]),
        chevron: inside(box(parts[0])),
        pill: pill === undefined ? null : inside(box(pill)),
        pillLook:
          pill === undefined ? null : look(pill, ["font-size", "color", "box-shadow", "border-radius", "padding-left"]),
        stack: stack === null ? null : inside(box(stack)),
        bars:
          column === undefined || column === null
            ? []
            : [...column.querySelectorAll("span.block")].slice(-2).map((bar) => inside(box(bar))),
      }
    })
  })
}

function expectNear(
  actual: Box,
  expected: Box,
  name: string,
  keys: readonly (keyof Box)[] = ["x", "y", "width", "height"],
) {
  for (const key of keys) {
    expect(
      Math.abs(actual[key] - expected[key]),
      `${name} ${key}: ${actual[key]} against ${expected[key]}`,
    ).toBeLessThanOrEqual(1)
  }
}

async function numbers(page: Page): Promise<string[]> {
  return page
    .locator("[data-slide-item]")
    .evaluateAll((items) => items.map((item) => item.firstElementChild?.textContent ?? ""))
}

async function headings(page: Page): Promise<string[]> {
  return page.locator("[data-section-head]").evaluateAll((items) => items.map((item) => item.textContent ?? ""))
}

test("a deck with sections lists each section's name above its slides and numbers the slides straight through", async ({
  page,
}) => {
  await open(page, sectioned)
  await expect(page.locator("[data-section-head]")).toHaveCount(2)
  expect(await headings(page)).toEqual(["Opening", "Numbers"])
  expect(await numbers(page)).toEqual(["1", "2"])
  const order = await page
    .locator("[data-slide-list] > *")
    .evaluateAll((rows) => rows.map((row) => row.hasAttribute("data-section-head")))
  expect(order).toEqual([true, false, true, false])
})

test("a new slide joins the section of the slide it comes after, and the sections stay after a reload", async ({
  page,
}) => {
  await open(page, sectioned)
  await page.locator("[data-slide-entry='1']").click()
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-item]")).toHaveCount(3)
  const rows = () =>
    page
      .locator("[data-slide-list] > *")
      .evaluateAll((items) =>
        items.map((item) =>
          item.hasAttribute("data-section-head")
            ? (item.textContent ?? "")
            : (item.querySelector("[data-slide-item]")?.firstElementChild?.textContent ?? ""),
        ),
      )
  expect(await rows()).toEqual(["Opening", "1", "2", "Numbers", "3"])
  await page.reload()
  await page.waitForFunction(() => document.querySelector(".thin-page")?.getAttribute("data-deck-ready") !== null)
  await expect(page.locator("[data-slide-item]")).toHaveCount(3)
  expect(await rows()).toEqual(["Opening", "1", "2", "Numbers", "3"])
})

test("a section collapses to its first slide with the range of its slides, opens again, and opens by itself for the slide in view", async ({
  page,
}) => {
  await open(page, sectioned)
  await page.locator("[data-slide-entry='1']").click()
  await page.getByRole("button", { name: "Add slide" }).click()
  await page.locator("[data-slide-entry='3']").click()
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-item]")).toHaveCount(4)
  const opening = page.locator("[data-section-head]").first()
  await expect(opening).toHaveAttribute("aria-expanded", "true")
  await opening.click()
  await expect(opening).toHaveAttribute("aria-expanded", "false")
  await expect(opening).toContainText("1 to 2")
  await expect(page.locator("[data-slide-item]")).toHaveCount(2)
  expect(await numbers(page)).toEqual(["3", "4"])
  await opening.click()
  await expect(page.locator("[data-slide-item]")).toHaveCount(4)
  await opening.click()
  await page.locator("[data-slide-entry='3']").click()
  await page.keyboard.press("Alt+ArrowUp")
  await expect(opening).toHaveAttribute("aria-expanded", "true")
})

test("a deck without sections lists its slides with no headings", async ({ page }) => {
  await open(page, clean)
  await expect(page.locator("[data-section-head]")).toHaveCount(0)
  await expect(page.locator("[data-slide-item]")).toHaveCount(1)
})

test("the real filmstrip draws section headings and a collapsed section where the designed editor puts them", async ({
  page,
}) => {
  await page.goto(designed)
  const design = await sections(page)
  await open(page, sectioned)
  await page.locator("[data-slide-entry='2']").click()
  await page.getByRole("button", { name: "Add slide" }).click()
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-item]")).toHaveCount(4)
  await page.locator("[data-section-head]").last().click()
  const real = await sections(page)
  const opened = real[0]
  const collapsed = real[1]
  const drawnOpen = design[0]
  const drawnCollapsed = design[2]
  if (opened === undefined || collapsed === undefined || drawnOpen === undefined || drawnCollapsed === undefined)
    throw new Error("sections")
  expectNear(opened.head, drawnOpen.head, "open heading", ["x", "width"])
  expect(opened.head.height).toBe(32)
  expectNear(opened.chevron, drawnOpen.chevron, "open chevron", ["x", "width", "height"])
  expectNear(opened.name, drawnOpen.name, "open name", ["x", "height"])
  expect(opened.nameLook).toEqual(drawnOpen.nameLook)
  expect(opened.pill).toBeNull()
  expectNear(collapsed.head, drawnCollapsed.head, "collapsed heading", ["x", "width"])
  expect(collapsed.head.height).toBe(32)
  expectNear(collapsed.chevron, drawnCollapsed.chevron, "collapsed chevron", ["x", "width", "height"])
  expect(collapsed.nameLook).toEqual(drawnCollapsed.nameLook)
  if (collapsed.pill === null || drawnCollapsed.pill === null) throw new Error("range")
  expectNear(collapsed.pill, drawnCollapsed.pill, "range", ["height"])
  expect(collapsed.pillLook).toEqual(drawnCollapsed.pillLook)
  if (collapsed.stack === null || drawnCollapsed.stack === null) throw new Error("stack")
  expectNear(collapsed.stack, drawnCollapsed.stack, "collapsed stack", ["x", "width"])
  expect(collapsed.bars.map((bar) => bar.width)).toEqual(drawnCollapsed.bars.map((bar) => bar.width))
  expect(collapsed.bars.map((bar) => bar.height)).toEqual(drawnCollapsed.bars.map((bar) => bar.height))
  expect(collapsed.stack.y - (collapsed.head.y + collapsed.head.height)).toBeCloseTo(
    drawnCollapsed.stack.y - (drawnCollapsed.head.y + drawnCollapsed.head.height),
    0,
  )
})

async function sectionList(file: string): Promise<string[]> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const presentation = (await reader.getEntries()).find((item) => item.filename === "ppt/presentation.xml")
  if (presentation === undefined) throw new Error("presentation")
  const text = Buffer.from(await presentation.getData(new zip.Uint8ArrayWriter())).toString("utf8")
  await reader.close()
  return [...text.matchAll(/<p14:section [^>]*name="([^"]*)"[\s\S]*?<\/p14:section>/g)].map(
    (section) => `${section[1]}:${[...section[0].matchAll(/<p14:sldId id="(\d+)"/g)].map((id) => id[1]).join(",")}`,
  )
}

test("a person moves the first slide of a section into the section above and undoes it, and the export lists the sections the file had", async ({
  page,
}, testInfo) => {
  await open(page, sectioned)
  const rows = () =>
    page
      .locator("[data-slide-list] > *")
      .evaluateAll((items) =>
        items.map((item) =>
          item.hasAttribute("data-section-head")
            ? (item.textContent ?? "")
            : (item.querySelector("[data-slide-item]")?.firstElementChild?.textContent ?? ""),
        ),
      )
  await page.locator("[data-slide-entry='2']").click()
  await page.keyboard.press("Alt+ArrowUp")
  await expect.poll(rows).toEqual(["Opening", "1", "2"])
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(rows).toEqual(["Opening", "1", "Numbers", "2"])
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const download = testInfo.outputPath("sections-undone.pptx")
  await (await saving).saveAs(download)
  expect(await sectionList(download)).toEqual(await sectionList(sectioned))
})
