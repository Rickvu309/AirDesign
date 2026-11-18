import { elementId, format, openRegister, slideId, type Register } from "@airdesign/document"
import { iconParts } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { iconMarkup, iconSvg, missingIcons, registerIcons } from "./icon-fallback"

const ink = "000000"

it("draws a Lucide icon as a black-stroked SVG of its nodes, and knows no icon by a made-up name", async () => {
  expect(
    iconMarkup([
      ["path", { d: "M1 2h3", key: "x" }],
      ["circle", { cx: 12, cy: 12, r: 3 }],
    ]),
  ).toBe(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 2h3"/><circle cx="12" cy="12" r="3"/></svg>`,
  )
  const rocket = await iconSvg("rocket")
  expect(rocket).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" [^>]+><path d="M12 15v5s3\.03-\.55 4-2/)
  expect(await iconSvg("rocketship")).toBeNull()
})

it("finds every icon a register shows: added icons, rows that set one, and icon fills", () => {
  const slide = slideId("256")
  const added = {
    slide: "element-add",
    id: slide,
    element: {
      node: elementId("256.5"),
      kind: "picture",
      value: null,
      box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
      grouped: false,
      opening: { image: { source: { set: "rocket" } } },
    },
  } as const
  const opened = openRegister("", "deck")
  const root = opened.elements[opened.nodes[0]!]!
  const node = elementId("256.2")
  const landed = [
    { actor: "person", visible: true, v: format, patch: { fills: { p0: { set: { image: "star" } } } } },
    { actor: "person", visible: true, v: format, patch: { image: { source: { set: "leaf" } } } },
  ] as const
  const register: Register = {
    ...opened,
    order: [added],
    nodes: [...opened.nodes, node],
    elements: { ...opened.elements, [node]: { ...root, landed } },
  }
  expect([...registerIcons(register)].sort()).toEqual(["leaf", "rocket", "star"])
  const held = new Map([
    [iconParts("rocket").svg, new Uint8Array()],
    [iconParts("rocket").png, new Uint8Array()],
  ])
  expect([...missingIcons(register, held)].sort()).toEqual(["leaf", "star"])
})
