import { expect, it } from "vitest"
import { defaultTheme, isRefusal, measureWith } from "../index.js"
import { expandComponent, readComponentSpec } from "./index.js"

const label = (i: number) => ({
  emit: {
    kind: "text",
    key: ["list", String(i)],
    x: i * 20,
    y: 0,
    w: 20,
    h: 70,
    chars: "WWWWWW",
    style: "body",
    color: defaultTheme.colors.text,
    align: "center",
    alignV: "top",
    fit: { group: "items", thin: 4, smaller: 18, advise: "Show fewer items." },
  },
})

it("ends a thinned group's finding with the advice its spec gives", () => {
  const spec = readComponentSpec({ version: 1, name: "Fixture", collections: {}, parts: [0, 1, 2, 3].map(label) })
  if (isRefusal(spec)) throw new Error(JSON.stringify(spec))
  const tree = expandComponent(spec, {
    data: {},
    frame: { x: 0, y: 0, w: 80, h: 200 },
    theme: defaultTheme,
    measure: measureWith({}),
  })
  if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
  expect(tree.findings).toContainEqual(
    expect.objectContaining({
      kind: "text-fit",
      key: ["items"],
      thinned: expect.any(Number),
      advice: "Show fewer items.",
    }),
  )
})

it("refuses advice on a group that never thins", () => {
  const unthinned = { ...label(0).emit, fit: { group: "items", smaller: 18, advise: "Show fewer items." } }
  expect(
    readComponentSpec({ version: 1, name: "Fixture", collections: {}, parts: [{ emit: unthinned }] }),
  ).toMatchObject({ refused: "shape" })
})
