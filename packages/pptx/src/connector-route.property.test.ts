import fc from "fast-check"
import {
  connectorEnds,
  decide,
  elementId,
  format,
  openRegister,
  outlineOf,
  sitePoint,
  undoOf,
  type Command,
  type ElementId,
  type ElementPatch,
  type Register,
} from "@airdesign/document"
import { beforeAll, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readSlides } from "./read-shapes.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>
type Box = { readonly x: number; readonly y: number }
type Step = { readonly node: ElementId; readonly before: ElementPatch; readonly after: ElementPatch }

const part = "ppt/slides/slide10.xml"
const rect = outlineOf(null, {})!
const opening: Readonly<Record<string, Box>> = { "6": { x: 4358398, y: 3042697 }, "15": { x: 3948437, y: 4728663 } }

let parts: Parts = new Map()
let slide = ""
let opened: Register

beforeAll(async () => {
  const fs = process.getBuiltinModule("node:fs")
  parts = await readParts(
    new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/census-updating-spm.pptx`)),
  )
  slide = readSlides(parts).find((each) => each.part === part)?.slide ?? ""
  const index = indexPackage(parts)
  opened = { ...openRegister("", "clean"), index: { ...index, total: index.elements.length, pages: [] } }
})

function applied(register: Register, commands: readonly Command[]): Register {
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, register)
}

function placeOf(exported: Parts, id: string) {
  const text = decodeUtf8(exported.get(part)!)
  const start = text.indexOf("<a:xfrm", text.indexOf(`<p:cNvPr id="${id}"`))
  const xfrm = text.slice(start, text.indexOf("</a:xfrm>", start))
  const number = (name: string) => Number(new RegExp(`${name}="(-?\\d+)"`).exec(xfrm)?.[1])
  return {
    box: { x: number(" x"), y: number(" y"), cx: number("cx"), cy: number("cy") },
    rot: 0,
    flipH: xfrm.includes('flipH="1"'),
    flipV: xfrm.includes('flipV="1"'),
  }
}

const boxPatch = (box: Box): ElementPatch => ({ box: { x: { set: box.x }, y: { set: box.y } } })

const operation = fc.oneof(
  fc.record({
    shape: fc.constantFrom("6", "15"),
    dx: fc.integer({ min: -3_000_000, max: 3_000_000 }),
    dy: fc.integer({ min: -3_000_000, max: 2_000_000 }),
  }),
  fc.constant("undo" as const),
)

it("keeps every bound end on its site after any sequence of moves and undos, and the file's bytes once all are undone", () => {
  fc.assert(
    fc.property(fc.array(operation, { minLength: 1, maxLength: 6 }), (operations) => {
      let register = opened
      const added = new Set<string>()
      const steps: Step[] = []
      const shown: Record<string, Box> = { ...opening }
      for (const each of operations) {
        if (each === "undo") {
          const step = steps.pop()
          if (step === undefined) continue
          const turn = undoOf(register, { steps: [step] })
          if (!turn.ok) throw new Error("undo")
          register = applied(register, turn.commands)
          const id = step.node.split(".")[1] ?? ""
          const box = step.before.box as { x: { set: number }; y: { set: number } }
          shown[id] = { x: box.x.set, y: box.y.set }
          continue
        }
        const node = elementId(`${slide}.${each.shape}`)
        const before = shown[each.shape]!
        const after = { x: before.x + each.dx, y: before.y + each.dy }
        const commands: Command[] = added.has(node) ? [] : [{ command: "add", node, floor: "", route: "clean" }]
        added.add(node)
        register = applied(register, [...commands, { command: "person", node, v: format, patch: boxPatch(after) }])
        steps.push({ node, before: boxPatch(before), after: boxPatch(after) })
        shown[each.shape] = after
      }
      const exported = exportParts(parts, register)
      const ends = connectorEnds(placeOf(exported, "26"))
      expect(ends.start).toEqual(sitePoint(placeOf(exported, "6"), rect, 2))
      expect(ends.end).toEqual(sitePoint(placeOf(exported, "15"), rect, 0))
      if (steps.length === 0) expect(decodeUtf8(exported.get(part)!)).toBe(decodeUtf8(parts.get(part)!))
    }),
    { numRuns: 30 },
  )
}, 60_000)
