import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { effectsCopy } from "@/copy/effects-copy"
import { visibleEffects } from "./effects-list"
import { panelOf } from "./panel"

const view: ScopedElement = {
  node: elementId("258.2"),
  facts: { kind: "shape", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914400, cy: 914400 },
}

function panel(fields: Readonly<Record<string, unknown>> = {}, kept: ScopedElement["kept"] = []) {
  return panelOf(
    { ...view, kept },
    {
      reads: {},
      moves: true,
      fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, own: true }])),
    },
  )
}

function effects(fields: Readonly<Record<string, unknown>> = {}, kept: ScopedElement["kept"] = []) {
  const section = panel(fields, kept).sections.find((each) => each.trait === "effects")
  if (section === undefined) throw new Error("effects")
  return visibleEffects(section)
}

it("hides empty effects behind add and writes only the effect a person adds", () => {
  const section = effects()
  expect(section.strips.flat().map((control) => control.field)).toEqual(["add"])
  const add = section.strips.flat()[0]
  if (add === undefined) throw new Error("add")
  expect(add.change("glow").effects?.glow).toEqual({
    halo: { radius: 63_500, color: { scheme: "accent1", transforms: [{ op: "alpha", val: 40_000 }] } },
  })
  expect(add.change("blur").effects).toEqual({ blur: { radius: 63_500 } })
  expect(add.change("innerShadow").effects?.innerShadow).toMatchObject({ inner: { blur: 50_800 } })
})

it("keeps a present shadow, removes only that effect, and adds the next one", () => {
  const shadow = {
    outer: { blur: 50_800, distance: 25_400, direction: 2_700_000, color: { rgb: "000000" } },
  }
  const section = effects({ "effects.shadow": shadow })
  expect(section.strips.flat().map((control) => control.field)).toEqual(["shadow", "remove.shadow", "add"])
  const add = section.strips.flat().find((control) => control.field === "add")
  expect(add?.desc).toMatchObject({ options: ["blur", "glow", "innerShadow", "shadow", "softEdge"] })
  const remove = section.strips.flat().find((control) => control.field === "remove.shadow")
  expect(remove?.change("remove").effects).toEqual({ shadow: { none: true } })
  expect(add?.change("shadow").effects?.drop1).toMatchObject({ outer: { blur: 50_800, distance: 38_100 } })
})

it("shows a second shadow on its own row and tells a title why it cannot add one", () => {
  const shadow = {
    outer: { blur: 50_800, distance: 25_400, direction: 2_700_000, color: { rgb: "000000" } },
  }
  const section = effects({ "effects.shadow": shadow, "effects.drop1": shadow })
  expect(section.strips.flat().map((control) => control.field)).toEqual([
    "shadow",
    "remove.shadow",
    "shadow",
    "remove.shadow.1",
    "add",
  ])
  const titled = panelOf(view, {
    reads: {},
    moves: true,
    role: "title",
    fields: { "effects.shadow": { value: shadow, own: true } },
  }).sections.find((each) => each.trait === "effects")
  if (titled === undefined) throw new Error("effects")
  const visible = visibleEffects(titled)
  expect(visible.strips[0]?.[0]?.label).toBe(effectsCopy.placeholder)
  expect(visible.strips.flat().find((control) => control.field === "add")?.desc).toMatchObject({
    options: ["blur", "glow", "innerShadow", "softEdge"],
  })
})

it("shows a kept effect graph and refuses another effect", () => {
  const section = effects({}, [
    "effects.shadow",
    "effects.innerShadow",
    "effects.glow",
    "effects.softEdge",
    "effects.blur",
  ])
  expect(section.strips.flat().map((control) => control.field)).toEqual(["kept.graph", "add"])
  expect(section.strips.flat()[0]?.label).toBe("Effect graph")
  expect(section.strips.flat()[1]?.change("shadow")).toEqual({ target: { node: view.node } })
})
