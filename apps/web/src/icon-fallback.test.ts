import { elementId, format, openRegister, slideId, writeTextValue, type Register } from "@airdesign/document"
import { iconParts } from "@airdesign/pptx"
import { expect, it, onTestFinished, vi } from "vitest"
import { iconMarkup, iconPng, iconSvg, missingIcons, registerIcons } from "./icon-fallback"

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
      kind: "shape",
      value: null,
      box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
      grouped: false,
      opening: { fills: { p0: { set: { image: true } }, source: { set: "rocket" } } },
    },
  } as const
  const opened = openRegister("", "deck")
  const root = opened.elements[opened.nodes[0]!]!
  const node = elementId("256.2")
  const landed = [
    {
      actor: "person",
      visible: true,
      v: format,
      patch: { fills: { p0: { set: { image: true } }, source: { set: "star" } } },
    },
    { actor: "person", visible: true, v: format, patch: { fills: { source: { set: "leaf" } } } },
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

it("finds an icon that fills text, so an export can embed it", () => {
  const opened = openRegister("", "deck")
  const root = opened.elements[opened.nodes[0]!]!
  const node = elementId("256.2")
  const value = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Moon", fill: { image: "moon" } }] }])
  const landed = [{ actor: "person", visible: true, v: format, patch: { text: { value: { set: value } } } }] as const
  const register: Register = {
    ...opened,
    nodes: [...opened.nodes, node],
    elements: { ...opened.elements, [node]: { ...root, landed } },
  }
  expect(registerIcons(register)).toEqual(["moon"])
})

it("makes an icon's PNG while the tab stays busy, since toBlob answers only when the browser goes idle", async () => {
  const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)
  const drawn: unknown[] = []
  vi.stubGlobal(
    "Image",
    class {
      src = ""
      decode() {
        return Promise.resolve()
      }
    },
  )
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: (...args: unknown[]) => drawn.push(args.slice(1)) }),
      toBlob: () => undefined,
      toDataURL: (type: string) => `data:${type};base64,${btoa(String.fromCharCode(...png))}`,
    }),
  })
  onTestFinished(() => {
    vi.unstubAllGlobals()
  })
  expect(await iconPng(await iconMarkupOf("star"), 64)).toEqual(png)
  expect(drawn).toEqual([[0, 0, 64, 64]])
})

async function iconMarkupOf(name: string): Promise<string> {
  const svg = await iconSvg(name)
  if (svg === null) throw new Error(name)
  return svg
}
