import {expect, it, vi} from "vitest"
import {prepareNativeTextEdit, textFitChanged} from "../../src/text/operations.ts"
import {fitFixture} from "./fit-fixture.ts"
import type {NativeText} from "../../src/text/native-v3.ts"


it("preserves exact saved fit on paint and page transforms without measuring", async () => {
  const previous = fitFixture(), next = structuredClone(previous), measure = vi.fn()
  next.box.x += 10
  next.box.y -= 12
  for (const paragraph of next.body.paragraphs) for (const style of [paragraph.endStyle, ...paragraph.runs.map(run => run.style)]) Object.assign(style, {color: null, highlight: "#abcdef", opacity: 0.2, outerShadow: {kind: "outer", blur: 4, distance: 12, direction: 128, scale: {x: 1, y: 0.3}, skew: {x: 21.67, y: 0}, alignment: "ctr", rotateWithShape: false, color: "#000000", opacity: 0.32} satisfies NonNullable<typeof style.outerShadow>})
  expect(textFitChanged(previous, next)).toBe(false)
  expect(await prepareNativeTextEdit(previous, next, measure)).toEqual({changes: [{kind: "set", target: next.id, value: next}]})
  expect(measure).not.toHaveBeenCalled()
})

it("invalidates all metric and local layout edits", () => {
  const previous = fitFixture()
  const edits: ((text: NativeText) => void)[] = [
    text => {text.body.paragraphs[0].runs.push({kind: "break", style: text.body.paragraphs[0].endStyle})},
    ...["font", "size", "bold", "letterSpacing"].map(key => (text: NativeText) => {const style = text.body.paragraphs[0].endStyle; Object.assign(style, {[key]: key === "font" ? "Different Metric Font" : key === "bold" ? !style.bold : 51})}),
    text => {text.body.paragraphs[0].spacing.before = 23},
    text => {text.body.paragraphs[0].indentation.left += 5},
    text => {text.body.paragraphs[0].marker = {kind: "number", start: 3, format: "decimal"}},
    text => {text.body.frame.insets.top += 1},
    text => {text.body.frame.wrap = "none"},
    text => {text.body.frame.verticalFlow = "vertical270"},
    text => {text.box.width += 1}, text => {text.box.height += 1},
  ]
  for (const edit of edits) {const next = structuredClone(previous); edit(next); expect(textFitChanged(previous, next)).toBe(true)}
})

it("bounds shrink, rejects impossible measurements, and leaves none alone", async () => {
  const previous = fitFixture(), next = structuredClone(previous)
  next.box.height = 100
  const measure = vi.fn(async (text: NativeText) => ({width: text.box.width, height: 200 * (text.body.frame.autofit.kind === "shrink" ? text.body.frame.autofit.fontScale ?? 1 : 1)}))
  const changes = await prepareNativeTextEdit(previous, next, measure)
  expect(changes.changes[0]).toMatchObject({value: {body: {frame: {autofit: {fontScale: 0.5, lineReduction: 0}}}}})
  expect(measure.mock.calls.length).toBeLessThanOrEqual(21)
  await expect(prepareNativeTextEdit(previous, next, async () => ({width: NaN, height: 1}))).rejects.toThrow("invalid-text-measurement")
  await expect(prepareNativeTextEdit(previous, next, async () => ({width: 1, height: 1000}))).rejects.toThrow("text-fit-unavailable")
  next.body.frame.autofit = {kind: "none"}
  measure.mockClear()
  await prepareNativeTextEdit(previous, next, measure)
  expect(measure).not.toHaveBeenCalled()
})
