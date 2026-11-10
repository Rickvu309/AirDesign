import fc from "fast-check"
import { expect, it } from "vitest"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyRoute, type SlideRoute } from "./slide-route.js"

const part = "ppt/slides/slide1.xml"
const shapeKinds = new Set(["p:sp", "p:pic", "p:graphicFrame", "p:cxnSp", "p:grpSp"])
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz "

type Run = { readonly text: string; readonly empty: boolean }
type Kind = "p:sp" | "p:pic" | "p:graphicFrame" | "p:cxnSp" | "p:grpSp"
type Shape = { readonly kind: Kind; readonly id: number; readonly runs: readonly Run[]; readonly nested: Shape | null }

const safeText = fc.array(fc.constantFrom(...letters.split("")), { maxLength: 8 }).map((chars) => chars.join(""))
const runArb: fc.Arbitrary<Run> = fc.record({ text: safeText, empty: fc.boolean() })
const spArb: fc.Arbitrary<Shape> = fc.record({
  kind: fc.constant("p:sp"),
  id: fc.constant(0),
  runs: fc.array(runArb, { minLength: 1, maxLength: 3 }),
  nested: fc.constant(null),
})
const bareArb: fc.Arbitrary<Shape> = fc.record({
  kind: fc.constantFrom("p:pic", "p:graphicFrame", "p:cxnSp"),
  id: fc.constant(0),
  runs: fc.constant([]),
  nested: fc.constant(null),
})
const groupArb: fc.Arbitrary<Shape> = spArb.map((nested) => ({ kind: "p:grpSp", id: 0, runs: [], nested }))

function numberShapes(shapes: readonly Shape[]): Shape[] {
  let next = 2
  const walk = (shape: Shape): Shape => {
    const id = next
    next += 1
    return {
      kind: shape.kind,
      id,
      runs: shape.kind === "p:sp" ? shape.runs : [],
      nested: shape.nested === null ? null : walk(shape.nested),
    }
  }
  return shapes.map(walk)
}

function xfrm(id: number): string {
  return `<a:off x="${1000 + id}" y="${2000 + id}"/><a:ext cx="${3000 + id}" cy="${4000 + id}"/>`
}

function runXml(id: number, run: Run, index: number): string {
  const marker = index === 0 ? "" : `Z${id}`
  const inner = run.empty && index === 0 ? "<a:t/>" : `<a:t>${run.text}${marker}</a:t>`
  const props = index === 0 ? `<a:rPr lang="en-US"/>` : `<a:rPr b="1"/>`
  return `<a:r>${props}${inner}</a:r>`
}

function shapeXml(shape: Shape): string {
  const id = shape.id
  const name = `<p:cNvPr id="${id}" name="S${id}"/>`
  if (shape.kind === "p:sp") {
    const runs = shape.runs.map((run, index) => runXml(id, run, index)).join("")
    return `<p:sp><p:nvSpPr>${name}<p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm>${xfrm(id)}</a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p>${runs}</a:p></p:txBody></p:sp>`
  }
  if (shape.kind === "p:pic") {
    return `<p:pic><p:nvPicPr>${name}<p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/></p:blipFill><p:spPr><a:xfrm>${xfrm(id)}</a:xfrm></p:spPr></p:pic>`
  }
  if (shape.kind === "p:graphicFrame") {
    return `<p:graphicFrame><p:nvGraphicFramePr>${name}<p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm>${xfrm(id)}</p:xfrm><a:graphic><a:graphicData uri="chart"/></a:graphic></p:graphicFrame>`
  }
  if (shape.kind === "p:cxnSp") {
    return `<p:cxnSp><p:nvCxnSpPr>${name}<p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm>${xfrm(id)}</a:xfrm></p:spPr></p:cxnSp>`
  }
  const nested = shape.nested === null ? "" : shapeXml(shape.nested)
  return `<p:grpSp><p:nvGrpSpPr>${name}<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm>${xfrm(id)}<a:chOff x="0" y="0"/><a:chExt cx="1" cy="1"/></a:xfrm></p:grpSpPr>${nested}</p:grpSp>`
}

function slideXml(shapes: readonly Shape[]): string {
  const body = shapes.map(shapeXml).join("")
  return `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>${body}</p:spTree></p:cSld></p:sld>`
}

function flatten(shapes: readonly Shape[]): Shape[] {
  const all: Shape[] = []
  for (const shape of shapes) {
    all.push(shape)
    if (shape.nested !== null) all.push(shape.nested)
  }
  return all
}

function shapeById(elements: readonly MarkupElement[], id: string): MarkupElement {
  for (const mark of elements) {
    if (mark.kind !== "p:cNvPr" || mark.id !== id) continue
    let parent = mark.parent
    while (parent >= 0) {
      const ancestor = elements[parent]
      if (ancestor === undefined) break
      if (shapeKinds.has(ancestor.kind)) return ancestor
      parent = ancestor.parent
    }
  }
  throw new Error("shape")
}

function routeFor(op: "text" | "move" | "resize" | "remove", target: Shape): SlideRoute {
  const shape = String(target.id)
  if (op === "text" && target.kind === "p:sp") return { name: "text", part, shape, text: "A & B\u0001\t" }
  if (op === "move") return { name: "move", part, shape, x: 3, y: 4 }
  if (op === "resize") return { name: "resize", part, shape, cx: 5, cy: 6 }
  return { name: "remove", part, shape }
}

it("edits only the requested shape in a mixed tree", () => {
  fc.assert(
    fc.property(
      fc.array(fc.oneof(spArb, bareArb, groupArb), { minLength: 1, maxLength: 4 }).map(numberShapes),
      fc.integer({ min: 0, max: 12 }),
      fc.constantFrom("text", "move", "resize", "remove"),
      (shapes, rawIndex, requested) => {
        const targets = flatten(shapes)
        const target = targets[rawIndex % targets.length]
        if (target === undefined) throw new Error("target")
        const op = requested === "text" && target.kind !== "p:sp" ? "remove" : requested
        const before = encodeUtf8(slideXml(shapes))
        const document = markupDocument(before)
        expect(document.wellFormed).toBe(true)
        const span = shapeById(document.elements, String(target.id))
        expect(span.kind).toBe(target.kind)
        const edited = applyRoute(new Map([[part, before]]), routeFor(op, target))
        const after = edited.get(part)
        if (after === undefined) throw new Error("part")
        expect(markupDocument(after).wellFormed).toBe(true)
        const prefix = before.subarray(0, span.start)
        const suffix = before.subarray(span.end)
        expect(after.subarray(0, prefix.length)).toEqual(prefix)
        expect(after.subarray(after.length - suffix.length)).toEqual(suffix)
        if (op === "remove") {
          const joined = new Uint8Array(prefix.length + suffix.length)
          joined.set(prefix, 0)
          joined.set(suffix, prefix.length)
          expect(after).toEqual(joined)
          return
        }
        const middle = after.subarray(prefix.length, after.length - suffix.length)
        const parsed = markupDocument(middle)
        const roots = parsed.elements.filter((item) => item.parent < 0)
        expect(parsed.wellFormed).toBe(true)
        expect(roots).toHaveLength(1)
        expect(roots[0]).toMatchObject({ kind: target.kind, start: 0, end: middle.length })
        expect(parsed.elements.some((item) => item.kind === "p:cNvPr" && item.id === String(target.id))).toBe(true)
        const text = decodeUtf8(middle)
        if (op === "text") {
          expect(after.includes(1)).toBe(false)
          expect(text).toContain("<a:t>A &amp; B\t</a:t>")
          expect(text).toContain(`lang="en-US"`)
          expect(text).not.toContain(`Z${target.id}`)
          expect(text).not.toContain(`b="1"`)
          const runs = parsed.elements.filter((item) => item.kind === "a:t")
          expect(runs).toHaveLength(1)
        }
        if (op === "move") expect(text).toContain(`<a:off x="3" y="4"/>`)
        if (op === "resize") expect(text).toContain(`<a:ext cx="5" cy="6"/>`)
        if (target.nested !== null) expect(text).toContain(`x="${1000 + target.nested.id}"`)
      },
    ),
    { numRuns: 30 },
  )
})
