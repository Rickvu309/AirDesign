import { scriptOf } from "../../packages/agent/src/testing/change-script.ts"
import { fontRoutes } from "../../packages/fonts/src/index.ts"
import { expect, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { test, type Stack } from "./api-stack"
import { designDoom, painted, pick, reloadDesign, saved, undoOnStage } from "./editor-design"
import { accent, landNodes, type Opened, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const flow = { mode: "column", gap: 24, padding: { t: 40, r: 40, b: 40, l: 40 }, align: "top-left" }

test("remove auto layout keeps the frame and every child where they were painted, and undo brings the layout back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    {
      id: "t:1",
      type: "frame",
      parent: slide,
      props: {
        name: "Stack",
        box: spot(400, 200, 10, 10),
        fills: [{ kind: "solid", color: { var: "background2" } }],
        layout: flow,
        sizing: { w: "hug", h: "hug" },
      },
    },
    { id: "t:2", type: "shape", parent: "t:1", props: { name: "First", box: spot(0, 0, 600, 160), fills: accent } },
    {
      id: "t:3",
      type: "shape",
      parent: "t:1",
      props: { name: "Second", box: spot(0, 0, 200, 160), fills: accent, sizing: { w: "fill", h: "fixed" } },
    },
  ])
  const before = await Promise.all(["t:1", "t:2", "t:3"].map((id) => painted(page, id).boundingBox()))
  await pick(page, "t:1", 410, 210)
  await page.locator("[data-auto-layout]").getByRole("button", { name: designCopy.removeAutoLayout }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:1")).layout?.mode).toBe("none")
  expect((await saved(stack, opened, "t:1")).box).toMatchObject({ x: 400, y: 200, w: 680, h: 424 })
  expect((await saved(stack, opened, "t:3")).box).toMatchObject({ x: 40, y: 224, w: 600, h: 160 })
  expect((await saved(stack, opened, "t:3")).sizing).toEqual({ w: "fixed", h: "fixed" })
  expect(await Promise.all(["t:1", "t:2", "t:3"].map((id) => painted(page, id).boundingBox()))).toEqual(before)
  await undoOnStage(page)
  await expect.poll(async () => (await saved(stack, opened, "t:1")).layout?.mode).toBe("column")
  expect((await saved(stack, opened, "t:3")).sizing).toEqual({ w: "fill", h: "fixed" })
})

const narrow = "Liberation Sans Narrow"
const lines = (frame: string, words: readonly (readonly [string, string])[]) =>
  words.map(([chars, font], at) => ({
    id: `${frame}${String(at + 2)}`,
    type: "shape" as const,
    parent: `${frame}1`,
    props: {
      name: chars,
      box: spot(0, 0, 1, 1),
      sizing: { w: "hug", h: "hug" },
      text: {
        chars,
        spans: [{ end: chars.length, font, size: 44 }],
        paras: [{}],
        style: "body",
        resize: "widthAndHeight",
        alignV: "top",
      },
    },
  }))

function twins(slide: string, mode: "row" | "column", words: readonly (readonly [string, string])[]) {
  return (["p:", "a:"] as const).flatMap((frame, at) => [
    {
      id: `${frame}1`,
      type: "frame" as const,
      parent: slide,
      props: {
        name: `${frame}1`,
        box: spot(60, 40 + at * 500, 1, 1),
        fills: [{ kind: "solid", color: { var: "background2" } }],
        layout: { mode, gap: 19, padding: { t: 32, r: 24, b: 32, l: 24 }, align: "top-left" },
        sizing: { w: "hug", h: "hug" },
      },
    },
    ...lines(frame, words),
  ])
}

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

async function bakeBoth(page: Page, stack: Stack, opened: Opened, count: number) {
  await reloadDesign(page)
  await expect(page.locator("[data-slide-box] [data-font-pending]")).toHaveCount(0)
  await pick(page, "p:1", 64, 44)
  await page.locator("[data-auto-layout]").getByRole("button", { name: designCopy.removeAutoLayout }).click()
  await expect.poll(async () => (await saved(stack, opened, "p:1")).layout?.mode).toBe("none")
  const [said] = await stack.toolBlocks(
    "airdesign_execute",
    { deck: opened.deck, script: scriptOf([{ op: "update", target: "a:1", layout: "none" }]) },
    opened.cookie,
  )
  const answer = JSON.parse(said?.text ?? "{}") as Record<string, unknown>
  const ids = Array.from({ length: count + 1 }, (_, at) => String(at + 1))
  const boxes = async (frame: string) =>
    Promise.all(ids.map(async (id) => (await saved(stack, opened, `${frame}${id}`)).box as Box))
  return { answer, person: await boxes("p:"), agent: await boxes("a:") }
}

function expectSameBoxes(person: readonly Box[], agent: readonly Box[]) {
  const [personFrame, ...personKids] = person
  const [agentFrame, ...agentKids] = agent
  const size = (box: Box | undefined) => ({ w: box?.w ?? 0, h: box?.h ?? 0, x: 0, y: 0 })
  for (const [at, [left, right]] of [
    [size(personFrame), size(agentFrame)],
    ...personKids.map((box, kid) => [box, agentKids[kid]!] as const),
  ].entries())
    for (const side of ["x", "y", "w", "h"] as const)
      expect(Math.abs(left[side] - right[side]), `box ${String(at)} ${side}`).toBeLessThanOrEqual(0.5)
}

test("an agent's layout none keeps each child where the person's Remove auto layout keeps it, with a typeface no one serves elsewhere on the slide", async ({
  page,
  context,
  stack,
}) => {
  const words = [
    ["Wiggle waves AVAVA", narrow],
    ["illi MMMM ... WWW", narrow],
  ] as const
  const opened = await designDoom(page, context, stack, (slide) => twins(slide, "row", words))
  const [elsewhere] = lines("u:", [["Unlisted typeface elsewhere", "AirDesign Missing Face"]])
  await landNodes(stack, opened, [
    { ...elsewhere!, parent: opened.slide, props: { ...elsewhere!.props, box: spot(1100, 960, 1, 1) } },
  ])
  const { answer, person, agent } = await bakeBoth(page, stack, opened, words.length)
  expect(answer, JSON.stringify(answer)).toMatchObject({ ok: true })
  expectSameBoxes(person, agent)
})

test("an agent's layout none keeps each child where the person's Remove auto layout keeps it, when the font lacks some Vietnamese letters", async ({
  page,
  context,
  stack,
}) => {
  const words = [
    ["lợi nhuận quý".normalize("NFD"), narrow],
    ["Then", narrow],
  ] as const
  const opened = await designDoom(page, context, stack, (slide) => twins(slide, "row", words))
  const { answer, person, agent } = await bakeBoth(page, stack, opened, words.length)
  expect(answer, JSON.stringify(answer)).toMatchObject({ ok: true })
  expectSameBoxes(person, agent)
})

test("an agent's layout none keeps Latin, Vietnamese and Japanese lines where the person's Remove auto layout keeps them, each in a served font", async ({
  page,
  context,
  stack,
}) => {
  const words = [
    ["Revenue grew 12% to $48.2M", narrow],
    ["Doanh thu quý 3 tăng, lợi nhuận giữ ở mức 31%", narrow],
    ["収益は前年比12%増加", "Noto Sans JP"],
  ] as const
  const opened = await designDoom(page, context, stack, (slide) => twins(slide, "column", words))
  const { answer, person, agent } = await bakeBoth(page, stack, opened, words.length)
  expect(answer, JSON.stringify(answer)).toMatchObject({ ok: true })
  expectSameBoxes(person, agent)
})

test("an agent's layout none refuses Japanese lines whose fallback the legacy measure lacks, and leaves the frame laid out", async ({
  page,
  context,
  stack,
}) => {
  const words = [
    ["Revenue grew 12%", narrow],
    ["収益", narrow],
    ["増加", narrow],
  ] as const
  const opened = await designDoom(page, context, stack, (slide) => twins(slide, "column", words))
  const { answer } = await bakeBoth(page, stack, opened, words.length)
  expect(answer).toMatchObject({ ok: false, refusal: "fonts", layers: ["a:3", "a:4"] })
  expect([...String(answer.characters)].sort()).toEqual([..."収益増加"].sort())
  expect((await saved(stack, opened, "a:1")).layout?.mode).toBe("column")
})

test("the person and agent bake the same box across a colour span and wrapped discretionary hyphens", async ({
  page,
  context,
  stack,
}) => {
  const words = [
    ["AVATAR office", narrow],
    ["soft\u00adhy\u00adphen\u00adated wordy\u00adwords", narrow],
  ] as const
  const opened = await designDoom(page, context, stack, (slide) =>
    twins(slide, "column", words).map((node) => {
      if (node.type !== "shape") return node
      const { props } = node
      if (node.id.endsWith("2")) {
        return {
          ...node,
          props: {
            ...props,
            text: {
              ...props.text,
              spans: [{ end: 1, font: narrow, size: 44, color: { var: "accent1" } }, ...props.text.spans],
            },
          },
        }
      }
      return {
        ...node,
        props: {
          ...props,
          box: spot(0, 0, 160, 1),
          sizing: { w: "fixed", h: "hug" },
          text: { ...props.text, resize: "height", wrap: "words" },
        },
      }
    }),
  )
  const { answer, person, agent } = await bakeBoth(page, stack, opened, words.length)
  expect(answer).toMatchObject({ ok: true })
  expectSameBoxes(person, agent)
})

test("an agent refuses Japanese contextual punctuation when the baked boxes differ", async ({
  page,
  context,
  stack,
}) => {
  const words = [["「東」、（テスト）。", "Noto Sans JP"]] as const
  const opened = await designDoom(page, context, stack, (slide) => twins(slide, "column", words))
  const { answer } = await bakeBoth(page, stack, opened, words.length)
  expect(answer).toMatchObject({ ok: false, refusal: "fonts" })
  expect(answer.reason).toMatch(/^shaping$/)
  expect((await saved(stack, opened, "a:1")).layout?.mode).toBe("column")
})

test("uses served Geist for an unserved family even when the browser knows its name", async ({
  page,
  context,
  stack,
}) => {
  const words = [
    ["Wide words in a locally installed font", "DejaVu Serif"],
    ["Quarter four", narrow],
  ] as const
  const opened = await designDoom(page, context, stack, (slide) => twins(slide, "row", words))
  const run = painted(page, "p:2").locator("[data-run]")
  await expect(run).toHaveCSS("font-family", /airdesign-face-.*family%3DGeist%26/)
  expect(await run.evaluate((node) => getComputedStyle(node).fontFamily)).not.toContain("DejaVu Serif")
  const { answer, person, agent } = await bakeBoth(page, stack, opened, words.length)
  expect(answer).toMatchObject({ ok: true })
  expectSameBoxes(person, agent)
})

for (const failure of ["held manifest", "failed manifest", "failed file"] as const) {
  test(`paints the slide with fallback during a ${failure} and paints once Geist arrives`, async ({
    page,
    context,
    stack,
  }) => {
    const words = [
      ["Doanh thu quý 3 tăng, giữ ở mức 31%", narrow],
      ["Quarter four", narrow],
    ] as const
    await designDoom(page, context, stack, (slide) => twins(slide, "row", words))
    const text = painted(page, "p:2")
    const pending = text.locator("[data-font-pending]")
    const ink = () =>
      text.locator("[data-line]").evaluateAll((lines) =>
        lines.map((line) => {
          const range = document.createRange()
          range.selectNodeContents(line)
          const { x, y, width, height } = range.getBoundingClientRect()
          return { x, y, width, height }
        }),
      )
    await expect(pending).toHaveCount(0)
    const expected = await ink()
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let asked = 0
    const path = failure === "failed file" ? fontRoutes.file.path : fontRoutes.family.path
    await page.route(
      (url) => url.pathname === path && url.searchParams.get("family") === "Geist",
      async (route) => {
        asked += 1
        if (failure === "failed manifest" && asked === 1) {
          await route.fulfill({ status: 503 })
          return
        }
        if (failure === "failed file" && asked === 1) {
          await route.abort()
          return
        }
        await held
        await route.continue()
      },
    )
    try {
      await page.reload({ waitUntil: "domcontentloaded" })
      await expect.poll(() => asked).toBeGreaterThanOrEqual(failure === "failed file" ? 2 : 1)
      await expect(page.locator("[data-editor-ready]")).toBeVisible()
      await expect(pending.first()).toBeVisible()
      if (failure === "held manifest") {
        await pick(page, "p:1", 64, 44)
        const action = page.locator("[data-auto-layout]")
        const remove = action.getByRole("button", { name: designCopy.removeAutoLayout })
        await expect(remove).toBeDisabled()
        await expect(remove).toHaveAccessibleDescription(designCopy.layoutFontPending)
        await expect(action.getByText(designCopy.layoutFontPending)).toBeVisible()
        await remove.focus()
        await page.keyboard.press("Shift+Tab")
        await expect(remove).not.toBeFocused()
        await page.keyboard.press("Tab")
        await expect(remove).toBeFocused()
        await expect(remove).toHaveCSS("outline-style", "solid")
        await page.keyboard.press("Enter")
        await expect(remove).toBeDisabled()
        const path = test.info().outputPath("remove-auto-layout-waiting.png")
        await action.screenshot({ path })
        await test.info().attach("Remove auto layout while a font loads", { path, contentType: "image/png" })
      }
    } finally {
      release()
    }
    await expect(page.locator("[data-editor-ready]")).toBeVisible()
    await expect(text).toBeVisible()
    await expect(pending).toHaveCount(0)
    await expect.poll(ink).toEqual(expected)
  })
}
