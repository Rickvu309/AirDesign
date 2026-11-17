import { expect, it } from "vitest"
import { slideId } from "@airdesign/document"
import { readParts } from "./package-container.js"
import { slideAddresses } from "./package-address.js"
import { applyStructuralRoute } from "./structural-route.js"
import { writeFields } from "./xml-codec.js"
import { linkXml, shownLink } from "./trait-xml-link.js"

declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }

it("keeps duplicate and self-links on the original destination, deactivates deletion and restores from the original", async () => {
  const original = await readParts(
    new Uint8Array(
      process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/clean.pptx`),
    ),
  )
  const at = { slide: "256", part: "ppt/slides/slide1.xml", shape: "2" }
  const target = { kind: "slide", slide: slideId("256") } as const
  const linked = writeFields(original, at, linkXml, { target: { set: target } })
  const cloned = applyStructuralRoute(linked, { name: "sldIdLst.clone", slide: "256", id: slideId("257") })
  const duplicate = slideAddresses(cloned).find((each) => each.slide === "257")!
  expect(shownLink(cloned, at)).toEqual(target)
  expect(shownLink(cloned, { ...duplicate, shape: "2" })).toEqual(target)
  const deleted = applyStructuralRoute(cloned, { name: "sldIdLst.remove", slide: "256" })
  expect(shownLink(deleted, { ...duplicate, shape: "2" })).toEqual({ kind: "none" })
  expect(shownLink(cloned, { ...duplicate, shape: "2" })).toEqual(target)
  expect(shownLink(original, at)).toEqual({ kind: "none" })
})
