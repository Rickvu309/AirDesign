import { expect, it } from "vitest"
import { planChange, registerScope } from "./change.js"
import { decide, landedPatch, openRegister, type Register } from "./decide.js"
import type { IndexElement } from "./deck-index.js"
import { elementId } from "./element-id.js"
import { format } from "./format.js"
import { beforeOf, netPatch, type Row } from "./row.js"
import { undoOf } from "./person-undo.js"
import type { Alpha, Color } from "./index.js"
import { changeEffects, readEffects, type Effect, type EffectKey } from "./effects-list.js"

const black = (alphaValue: number): Color => ({ rgb: "000000", transforms: [{ op: "alpha", val: alphaValue }] })

const medium = { blur: 50_800, distance: 25_400, direction: 2_700_000, color: black(25_000) }
const glow: Effect = { kind: "glow", radius: 63_500, color: { scheme: "accent1" } }
const inner: Effect = { kind: "innerShadow", ...medium }
const blur: Effect = { kind: "blur", radius: 63_500 }
const shadow: Effect = { kind: "shadow", ...medium }

function kinds(source: Parameters<typeof readEffects>[0]): readonly string[] {
  return readEffects(source).list.map((entry) => ("kept" in entry ? entry.kept : entry.effect.kind))
}

function written(change: ReturnType<typeof changeEffects>) {
  if (!change.ok) throw new Error(change.refusal)
  return change.effects
}

function keyOf(source: Parameters<typeof readEffects>[0], kind: string): EffectKey {
  const entry = readEffects(source).list.find((each) => ("kept" in each ? each.kept : each.effect.kind) === kind)
  if (entry === undefined) throw new Error(kind)
  return entry.key
}

it("picks Medium by writing only the drop shadow", () => {
  const shown = readEffects({
    landed: { glow: { set: { halo: { radius: glow.radius, color: glow.color } } } },
  })
  expect(changeEffects(shown, { slide: { shadow: "medium" } })).toEqual({
    ok: true,
    effects: { shadow: { outer: medium } },
  })
})

it("writes shadow opacity onto the same shadow and leaves its offset", () => {
  const shown = readEffects({ landed: { shadow: { set: { outer: medium } } } })
  const pick = changeEffects(shown, { slide: { opacity: 40_000 as Alpha } })
  expect(pick).toEqual({
    ok: true,
    effects: { shadow: { outer: { ...medium, color: black(40_000) } } },
  })
  expect(readEffects({ landed: { shadow: { set: { outer: { ...medium, color: black(40_000) } } } } }).slide).toEqual({
    shadow: "medium",
    opacity: 40_000,
  })
})

it("applies a strength and an opacity in one edit", () => {
  const shown = readEffects({})
  expect(changeEffects(shown, { slide: { shadow: "medium", opacity: 40_000 as Alpha } })).toEqual({
    ok: true,
    effects: { shadow: { outer: { ...medium, color: black(40_000) } } },
  })
})

it("refuses opacity when the layer has no drop shadow", () => {
  expect(changeEffects(readEffects({}), { slide: { opacity: 40_000 as Alpha } })).toEqual({
    ok: false,
    refusal: "limit",
  })
})

it("writes a second drop shadow into the next slot and keeps the first", () => {
  const shown = readEffects({ landed: { shadow: { set: { outer: medium } } } })
  expect(shown.addable).toEqual(["blur", "glow", "innerShadow", "shadow", "softEdge"])
  const added = changeEffects(shown, { add: shadow })
  expect(added).toEqual({ ok: true, effects: { drop1: { outer: medium } } })
  const both = readEffects({
    landed: { shadow: { set: { outer: medium } }, drop1: { set: { outer: medium } } },
  })
  expect(both.list.map((entry) => entry.key)).toEqual(["shadow", "shadow.1"])
  expect(both.slide).toEqual({ shadow: "custom", opacity: null })
  expect(changeEffects(both, { slide: { shadow: "medium" } })).toEqual({
    ok: true,
    effects: { shadow: { outer: medium } },
  })
})

it("adds a glow, an inner shadow or a blur as that field alone", () => {
  const shown = readEffects({ landed: { shadow: { set: { outer: medium } } } })
  expect(changeEffects(shown, { add: glow })).toEqual({
    ok: true,
    effects: { glow: { halo: { radius: glow.radius, color: glow.color } } },
  })
  expect(changeEffects(shown, { add: inner })).toEqual({
    ok: true,
    effects: { innerShadow: { inner: medium } },
  })
  expect(changeEffects(shown, { add: blur })).toEqual({ ok: true, effects: { blur: { radius: blur.radius } } })
})

it("removes one effect by clearing only its field", () => {
  const source = {
    landed: {
      shadow: { set: { outer: medium } },
      glow: { set: { halo: { radius: glow.radius, color: glow.color } } },
    },
  } as const
  expect(changeEffects(readEffects(source), { remove: keyOf(source, "shadow") })).toEqual({
    ok: true,
    effects: { shadow: { none: true } },
  })
})

it("keeps a key when another kind is added and when the effect is edited", () => {
  const source = { landed: { shadow: { set: { outer: medium } } } }
  const before = keyOf(source, "shadow")
  const added = readEffects({
    landed: {
      shadow: { set: { outer: medium } },
      glow: { set: { halo: { radius: glow.radius, color: glow.color } } },
    },
  })
  expect(keyOf(source, "shadow")).toBe(before)
  expect(before).toBe("shadow")
  const edited = { ...shadow, blur: 1 }
  expect(changeEffects(added, { at: before, effect: edited })).toEqual({
    ok: true,
    effects: {
      shadow: { outer: { blur: 1, distance: medium.distance, direction: medium.direction, color: medium.color } },
    },
  })
  expect(keyOf(source, "shadow")).toBe(before)
})

it("refuses every edit of an effect graph", () => {
  const shown = readEffects({ kept: ["graph"], landed: { shadow: { set: { outer: medium } } } })
  expect(shown.list).toEqual([{ key: "graph", kept: "graph" }])
  expect(shown.addable).toEqual([])
  expect(changeEffects(shown, { add: glow })).toEqual({ ok: false, refusal: "kept" })
  expect(changeEffects(shown, { slide: { shadow: "strong" } })).toEqual({ ok: false, refusal: "kept" })
  expect(changeEffects(shown, { remove: keyOf({ kept: ["graph"] }, "graph") })).toEqual({ ok: false, refusal: "kept" })
})

it("lists a reflection, refuses to remove it, and still edits the shadow", () => {
  const source = { landed: { shadow: { set: { outer: medium } } }, kept: ["reflection"] as const }
  const shown = readEffects(source)
  expect(kinds(source)).toEqual(["shadow", "reflection"])
  expect(changeEffects(shown, { remove: keyOf(source, "reflection") })).toEqual({ ok: false, refusal: "kept" })
  const edited = { ...shadow, distance: 1 }
  expect(written(changeEffects(shown, { at: keyOf(source, "shadow"), effect: edited }))).toEqual({
    shadow: { outer: { ...medium, distance: 1 } },
  })
})

it("orders modeled and kept effects as DrawingML does", () => {
  expect(
    kinds({
      landed: {
        shadow: { set: { outer: medium } },
        glow: { set: { halo: { radius: 1, color: black(10_000) } } },
        innerShadow: { set: { inner: medium } },
        softEdge: { set: { radius: 1 } },
        blur: { set: { radius: 2 } },
      },
      kept: ["fillOverlay", "reflection"],
    }),
  ).toEqual(["blur", "fillOverlay", "glow", "innerShadow", "shadow", "reflection", "softEdge"])
})

it("calls a shadow that matches no strength custom and hides its opacity", () => {
  const shown = readEffects({ landed: { shadow: { set: { outer: { ...medium, blur: 999 } } } } })
  expect(shown.slide).toEqual({ shadow: "custom", opacity: null })
})

it("reads an empty list as no shadow", () => {
  expect(readEffects({}).slide).toEqual({ shadow: "none", opacity: null })
  expect(readEffects({}).addable).toEqual(["blur", "glow", "innerShadow", "shadow", "softEdge"])
  expect(readEffects({}).list).toEqual([])
  expect(readEffects({}).own).toBe(false)
})

it("lets a kept preset shadow take the drop shadow place", () => {
  const shown = readEffects({ kept: ["presetShadow"] })
  expect(kinds({ kept: ["presetShadow"] })).toEqual(["presetShadow"])
  expect(shown.addable).not.toContain("shadow")
  expect(changeEffects(shown, { add: shadow })).toEqual({ ok: false, refusal: "limit" })
  expect(changeEffects(shown, { slide: { shadow: "medium" } })).toEqual({ ok: false, refusal: "limit" })
})

it("shows a landed shadow beside an opening glow", () => {
  const shown = readEffects({
    opening: { glow: { set: { halo: { radius: glow.radius, color: glow.color } } } },
    landed: { shadow: { set: { outer: medium } } },
  })
  expect(
    kinds({
      opening: { glow: { set: { halo: { radius: glow.radius, color: glow.color } } } },
      landed: { shadow: { set: { outer: medium } } },
    }),
  ).toEqual(["glow", "shadow"])
  expect(shown.own).toBe(true)
})

it("clears a slot a row inherits and still counts the layer as owning effects", () => {
  const shown = readEffects({
    opening: { shadow: { set: { outer: medium } } },
    landed: { shadow: "inherit" },
  })
  expect(shown.list).toEqual([])
  expect(shown.own).toBe(true)
})

it("names the three strengths by PowerPoint's sizes", () => {
  const shown = readEffects({})
  expect(written(changeEffects(shown, { slide: { shadow: "subtle" } }))).toEqual({
    shadow: {
      outer: { blur: 25_400, distance: 12_700, direction: 2_700_000, color: black(15_000) },
    },
  })
  expect(written(changeEffects(shown, { slide: { shadow: "strong" } }))).toEqual({
    shadow: {
      outer: { blur: 101_600, distance: 50_800, direction: 2_700_000, color: black(35_000) },
    },
  })
})

it("fills empty shadow slots in order, refuses a fifth, and refuses a second on a title", () => {
  let source: Parameters<typeof readEffects>[0] = { landed: { shadow: { set: { outer: medium } } } }
  for (const slot of ["drop1", "drop2", "drop3"] as const) {
    const added = changeEffects(readEffects(source), { add: shadow })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    source = { landed: { ...source.landed, [slot]: { set: added.effects[slot] } } }
  }
  expect(readEffects(source).list.map((entry) => entry.key)).toEqual(["shadow", "shadow.1", "shadow.2", "shadow.3"])
  expect(changeEffects(readEffects(source), { add: shadow })).toEqual({ ok: false, refusal: "limit" })
  const titled = readEffects({ landed: { shadow: { set: { outer: medium } } }, placeholder: true })
  expect(titled.addable).toEqual(["blur", "glow", "innerShadow", "softEdge"])
  expect(changeEffects(titled, { add: shadow })).toEqual({ ok: false, refusal: "placeholder" })
  expect(changeEffects(readEffects({ placeholder: true }), { add: shadow }).ok).toBe(true)
})

it("removes one extra shadow without moving the others", () => {
  const source = {
    landed: {
      shadow: { set: { outer: medium } },
      drop1: { set: { outer: medium } },
      drop2: { set: { outer: medium } },
    },
  }
  expect(changeEffects(readEffects(source), { remove: keyOf(source, "shadow") })).toEqual({
    ok: true,
    effects: { shadow: { none: true } },
  })
  const second = readEffects(source).list.find((entry) => entry.key === "shadow.1")
  if (second === undefined) throw new Error("shadow.1")
  expect(changeEffects(readEffects(source), { remove: second.key })).toEqual({
    ok: true,
    effects: { drop1: { none: true } },
  })
})

it("keeps two shadows two people added at once, and lets the later write win on one slot", () => {
  const row = (patch: Row["patch"]): Row => ({ v: format, patch })
  const first = row({ effects: { drop1: { set: { outer: medium } } } })
  const second = row({ effects: { drop2: { set: { outer: medium } } } })
  expect(netPatch([first, second]).effects).toEqual({
    drop1: { set: { outer: medium } },
    drop2: { set: { outer: medium } },
  })
  const later = row({ effects: { drop1: { set: { outer: { ...medium, blur: 1 } } } } })
  expect(netPatch([first, later]).effects).toEqual({ drop1: { set: { outer: { ...medium, blur: 1 } } } })
})

it("plans two Drop shadows and two Inner shadows as one row and undoes all four in one step", () => {
  const node = elementId("258.4")
  const shape: IndexElement = {
    node,
    kind: "shape",
    value: null,
    box: { x: 0, y: 0, cx: 100, cy: 100 },
    grouped: false,
    kept: [],
  }
  const slides = [{ id: "258", position: 0 }]
  const indexed = (): Register => ({
    ...openRegister("", "deck"),
    index: { format, total: 1, slides, elements: [shape], pages: [] },
  })
  const shown = readEffects({ landed: { shadow: { set: { outer: medium } } } })
  const added = changeEffects(shown, { add: shadow })
  if (!added.ok) throw new Error(added.refusal)
  const effects = {
    shadow: { outer: medium },
    innerShadow: { inner: medium },
    inner1: { inner: medium },
    ...added.effects,
  }
  const planned = planChange({ target: { node }, effects }, registerScope(indexed()))
  const title: IndexElement = { ...shape, role: "title" }
  const titleDeck = { ...indexed(), index: { format, total: 1, slides, elements: [title], pages: [] } }
  expect(planChange({ target: { node }, effects }, registerScope(titleDeck))).toEqual({
    ok: false,
    refusals: [{ node, trait: "effects", code: "kind" }],
  })
  expect(planned.ok).toBe(true)
  if (!planned.ok) return
  expect(planned.rows).toHaveLength(1)
  const patch = planned.rows[0]?.row.patch
  if (patch === undefined) throw new Error("patch")
  expect(patch.effects).toEqual({
    shadow: { set: { outer: medium } },
    drop1: { set: { outer: medium } },
    innerShadow: { set: { inner: medium } },
    inner1: { set: { inner: medium } },
  })
  const addedNode = decide(indexed(), { command: "add", node, floor: "", route: "clean" })
  if (addedNode.decision !== "apply") throw new Error(addedNode.code)
  const body = addedNode.register.elements[node]
  if (body === undefined) throw new Error("node")
  const before = beforeOf(landedPatch(body, "text"), patch)
  const applied = decide(addedNode.register, { command: "person", node, v: format, patch })
  if (applied.decision !== "apply") throw new Error(applied.code)
  const undone = undoOf(applied.register, { steps: [{ node, before, after: patch }] })
  expect(undone.ok).toBe(true)
  if (undone.ok) expect(undone.commands).toHaveLength(1)
})
