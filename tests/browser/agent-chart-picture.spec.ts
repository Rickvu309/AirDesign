import { expect } from "@playwright/test"
import { forward, signInBrowser, test, type Stack } from "./api-stack"

type Block = { readonly type: string; readonly text?: string; readonly data?: string }

const box = { x: 48, y: 140, w: 864, h: 320 }
const plan = [13.2, 13.6, 14]
const actual = [13.9, 14.4, 15.1]

function chartValue(legend: "top" | "bottom", planColor: unknown): string {
  return JSON.stringify({
    kind: "bar",
    categories: ["Jul", "Aug", "Sep"],
    series: [
      { name: "Plan", values: plan, color: planColor },
      { name: "Actual", values: actual, color: { scheme: "accent1" } },
    ],
    labels: "$#,##0.0",
    legend,
    valueTitle: "Revenue, $M",
    gridlines: false,
  })
}

test.use({ viewport: { width: 1600, height: 1000 } })

async function readContent(stack: Stack, args: unknown, cookie: string): Promise<readonly Block[]> {
  const response = await fetch(`${stack.origin}${stack.mcp}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", cookie },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "airdesign_read_deck", arguments: args },
    }),
  })
  const data = (await response.text()).split("\n").find((line) => line.startsWith("data:"))
  const answer = JSON.parse(data?.slice("data:".length) ?? "{}") as { result?: { content?: readonly Block[] } }
  return answer.result?.content ?? []
}

test("an agent's picture shows each bar at its own value with the labels clear of the legend, and a new picture after the chart changes", async ({
  page,
  context,
  stack,
  decks,
}, testInfo) => {
  const { pictureWords } = await import("../../packages/mcp/src/slide-pictures.ts")
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  await expect.poll(async () => (await stack.callTool("airdesign_read_deck", { deck }, cookie)).index).toBe("ready")
  const read = await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)
  const added = (await stack.callTool(
    "airdesign_edit_deck",
    {
      deck,
      base: Number(read.revision),
      changes: [
        { op: "add", kind: "chart", slide: "256", box, chart: { value: chartValue("top", { scheme: "lt2" }) } },
      ],
    },
    cookie,
  )) as { readonly ok: boolean; readonly revision: number; readonly elements: readonly { readonly node: string }[] }
  expect(added).toMatchObject({ ok: true })
  const node = added.elements[0]?.node ?? ""
  const pictured = async (revision: number) => {
    const content = await readContent(stack, { deck, slide: "256", picture: true }, cookie)
    expect(content.flatMap((block) => (block.text === undefined ? [] : [block.text]))).toContain(
      pictureWords.slide(1, "256", revision),
    )
    return content.find((block) => block.type === "image")?.data ?? ""
  }
  const first = await pictured(added.revision)
  await testInfo.attach("picture with the legend on top", {
    body: Buffer.from(first, "base64"),
    contentType: "image/jpeg",
  })
  const chart = page.locator("[data-slide-paint] svg[data-chart]")
  const drawn = () =>
    chart.evaluate((svg) => {
      const side = (element: Element) => {
        const { top, bottom, height } = element.getBoundingClientRect()
        return { top, bottom, height }
      }
      const bars = [...svg.querySelectorAll("rect")].map(side).filter((bar) => bar.height > 0)
      const words = (prefix: string) =>
        [...svg.querySelectorAll(`[data-chart-text^="${prefix}"]`)].map((element) => ({
          text: element.textContent,
          ...side(element),
        }))
      return { bars, labels: words("label"), legend: words("legend"), categories: words("category") }
    })
  const top = await drawn()
  const heights = [...top.bars.map((bar) => bar.height)].sort((left, right) => left - right)
  expect(heights.length).toBeGreaterThanOrEqual(6)
  const tallest = heights.at(-1) ?? 0
  const shortest = heights.at(-6) ?? 0
  expect(shortest / tallest).toBeLessThan(0.2)
  const legendBottom = Math.max(...top.legend.map((entry) => entry.bottom))
  expect(top.labels).toHaveLength(6)
  expect(Math.min(...top.labels.map((label) => label.top))).toBeGreaterThanOrEqual(legendBottom)
  const changed = await stack.callTool(
    "airdesign_edit_deck",
    {
      deck,
      base: added.revision,
      changes: [{ op: "set", target: node, chart: { value: chartValue("bottom", { rgb: "B8C0CC" }) } }],
    },
    cookie,
  )
  expect(changed).toMatchObject({ ok: true })
  const second = await pictured(Number(changed.revision))
  await testInfo.attach("picture after the chart changed", {
    body: Buffer.from(second, "base64"),
    contentType: "image/jpeg",
  })
  expect(second).not.toBe(first)
  const bottom = await drawn()
  expect(Math.min(...bottom.legend.map((entry) => entry.top))).toBeGreaterThan(
    Math.max(...bottom.categories.map((category) => category.top)),
  )
  await page.reload()
  await decks.ready()
  await expect(chart).toBeVisible()
})
