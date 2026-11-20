import { iconParts } from "@airdesign/pptx"
import { expect, it, onTestFinished, vi } from "vitest"
import { iconMarkup, iconPng, iconSvg, missingIcons } from "./icon-fallback"

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

it("draws an icon at its weight, Lucide's 2 unless a weight is given", () => {
  const nodes = [["path", { d: "M1 2h3" }]] as const
  expect(iconMarkup(nodes)).toContain('stroke-width="2"')
  expect(iconMarkup(nodes, 150)).toContain('stroke-width="1.5"')
  expect(iconMarkup(nodes, 275)).toContain('stroke-width="2.75"')
})

it("finds every icon the written slides link but neither the file nor the device holds", () => {
  const link = (id: number, target: string) =>
    `<Relationship Id="rId${String(id)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${[
    "../media/icon-rocket.w150.png",
    "../media/icon-rocket.w150.svg",
    "../media/icon-star.png",
    "../media/icon-star.svg",
    "../media/icon-leaf.svg",
    "../media/image1.png",
  ]
    .map((target, at) => link(at + 1, target))
    .join("")}</Relationships>`
  const painted = new Map([
    ["ppt/slides/_rels/slide1.xml.rels", new TextEncoder().encode(rels)],
    [iconParts("leaf").svg, new Uint8Array()],
  ])
  const held = new Map([
    [iconParts("star").svg, new Uint8Array()],
    [iconParts("star").png, new Uint8Array()],
  ])
  expect(missingIcons(painted, held)).toEqual([{ name: "rocket", weight: 150 }])
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
