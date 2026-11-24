import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import type { PanelControl } from "@/design/panel"
import { changeWrites } from "./design-changes"
import { nodeModel } from "./design-model"
import { grow, spot } from "./testing/doom-fixtures"

function textBox(
  chars: string,
  paras: readonly doom.Para[],
  alignV: doom.Text["alignV"] = "top",
  resize: doom.Text["resize"] = "fixed",
) {
  const text: doom.Text = { chars, spans: [], paras, style: "body", resize, alignV }
  return grow([{ type: "shape", name: "words", props: { box: spot(0, 0, 400, 100), text } }])
}

function controlOf(built: ReturnType<typeof textBox>, field: string): PanelControl | undefined {
  return nodeModel({
    view: built.view,
    id: built.ids.words!,
    theme: doom.defaultTheme,
    slides: built.slides,
  })
    .sections.flatMap((section) => section.strips.flat())
    .find((control) => control.field === field)
}

function lineYs(view: doom.Doom, slide: doom.NodeId, measure: ReturnType<typeof grow>["measure"]) {
  return doom.resolveSlide(view, slide, measure).flatMap((part) => part.text?.lines.map((line) => line.y) ?? [])
}

function applied(view: doom.Doom, writes: readonly doom.Write[]) {
  const edit: doom.Landed = {
    once: "place",
    author: { kind: "person", id: "test" },
    writes: writes.map((write) => {
      const was = view.revs.get(write.node)?.get(write.prop)
      return was === undefined ? write : { ...write, base: was }
    }),
    rev: doom.rev(view.rev + 1),
  }
  const after = doom.applyEdit(view, edit)
  if (doom.isRefusal(after)) throw new Error("refused")
  return { after, edit }
}

it("sets vertical align to the bottom of a fixed box and undoes in one edit", () => {
  const built = textBox("hello", [{}])
  const id = built.ids.words!
  const control = controlOf(built, "alignV")
  expect(control?.label).toBe("Vertical align")
  const context = {
    view: built.view,
    ids: [id],
    geometry: built.geometry,
    size: doom.deckOf(built.view).size,
    slides: built.slides,
  }
  const writes = changeWrites(context, control!, "bottom")
  const { after, edit } = applied(built.view, writes)
  expect(doom.propOf(after.nodes.get(id), "text")?.alignV).toBe("bottom")
  const before = lineYs(built.view, built.slides[0]!, built.measure)
  const painted = lineYs(after, built.slides[0]!, built.measure)
  expect(painted[0]).toBeGreaterThan(before[0] ?? 0)
  const undone = doom.applyEdit(after, {
    once: "undo",
    author: { kind: "person", id: "test" },
    writes: doom.invert(built.view, after, edit),
    rev: doom.rev(after.rev + 1),
  })
  if (doom.isRefusal(undone)) throw new Error("undo refused")
  expect(doom.propOf(undone.nodes.get(id), "text")?.alignV).toBe("top")
})

it("offers vertical align only on text whose box has a fixed height, as Figma does", () => {
  const offered = (resize: doom.Text["resize"]) =>
    controlOf(textBox("hello", [{}], "top", resize), "alignV") !== undefined
  expect(offered("fixed")).toBe(true)
  expect(offered("truncate")).toBe(true)
  expect(offered("height")).toBe(false)
  expect(offered("widthAndHeight")).toBe(false)
})
