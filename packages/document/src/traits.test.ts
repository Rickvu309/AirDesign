import { describe, expect, it } from "vitest"
import { kinds, kindTraits, type FieldKey } from "./index.js"
import type { Alpha } from "./value-kind.js"
import {
  alphaKeys,
  fieldKeys,
  inheritable,
  keptRefuses,
  traitNames,
  traits,
  type FieldName,
  type FieldValue,
  type HasAlpha,
  type TraitValue,
  type WireAgent,
  type WireField,
} from "./traits.js"

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Expect<T extends true> = T

export type Derived = [
  Expect<Same<FieldName<"box">, "x" | "y" | "w" | "h" | "rot" | "flipH" | "flipV">>,
  Expect<Same<FieldName<"geometry">, "shape">>,
  Expect<Same<FieldValue<"box", "flipH">, boolean>>,
  Expect<Same<FieldValue<"box", "w">, number>>,
  Expect<Same<TraitValue<"notes">, { readonly value: string }>>,
  Expect<
    Same<
      FieldName<"fills">,
      | "p0"
      | "p1"
      | "p2"
      | "p3"
      | "source"
      | "weight"
      | "color"
      | "mode"
      | "tileScale"
      | "crop"
      | "recolor"
      | "blur"
      | "alpha"
    >
  >,
  Expect<Same<FieldValue<"fills", "alpha">, Alpha>>,
  Expect<
    Same<
      WireField<"fills">,
      "paint" | "source" | "weight" | "color" | "mode" | "tileScale" | "crop" | "recolor" | "blur" | "overlay"
    >
  >,
  Expect<
    Same<FieldName<"border">, "width" | "fill" | "dash" | "cap" | "compound" | "join" | "head" | "tail" | "alpha">
  >,
  Expect<null extends WireAgent<"border", "width"> ? true : false>,
  Expect<"none" | "accent2" extends WireAgent<"border", "fill"> ? true : false>,
  Expect<null extends WireAgent<"fills", "paint"> ? true : false>,
  Expect<null extends WireAgent<"box", "x"> ? false : true>,
  Expect<"none" | "group" | "accent1" extends WireAgent<"fills", "paint"> ? true : false>,
  Expect<Same<WireField<"box">, "x" | "y" | "w" | "h" | "rot" | "flipH" | "flipV" | "align" | "distribute">>,
  Expect<"center" extends WireAgent<"box", "align"> ? true : false>,
  Expect<Same<WireAgent<"box", "x">, number>>,
  Expect<Same<WireAgent<"text", "value">, string>>,
  Expect<Same<HasAlpha, true>>,
  Expect<"fills.p3" extends FieldKey ? true : false>,
  Expect<"border.width" extends FieldKey ? true : false>,
  Expect<"border.alpha" extends FieldKey ? true : false>,
  Expect<Same<WireField<"border">, Exclude<FieldName<"border">, "alpha">>>,
]

describe("the one table of traits", () => {
  it("declares how the traits inherit in PowerPoint", () => {
    expect(Object.fromEntries(traitNames.map((name) => [name, traits[name].inherits]))).toEqual({
      identity: "own",
      link: "own",
      box: "whole",
      geometry: "whole",
      fills: "whole",
      border: "field",
      effects: "whole",
      body: "field",
      text: "run",
      connection: "own",
      notes: "own",
      templateStyle: "own",
      show: "own",
      transition: "own",
      guides: "own",
      layout: "own",
    })
  })

  it("holds only the fields that are live", () => {
    expect(traitNames.flatMap(fieldKeys)).toEqual([
      "identity.name",
      "identity.alt",
      "identity.hidden",
      "identity.locked",
      "identity.mask",
      "link.target",
      "box.x",
      "box.y",
      "box.w",
      "box.h",
      "box.rot",
      "box.flipH",
      "box.flipV",
      "geometry.shape",
      "fills.p0",
      "fills.p1",
      "fills.p2",
      "fills.p3",
      "fills.source",
      "fills.weight",
      "fills.color",
      "fills.mode",
      "fills.tileScale",
      "fills.crop",
      "fills.recolor",
      "fills.blur",
      "fills.alpha",
      "border.fill",
      "border.width",
      "border.dash",
      "border.cap",
      "border.compound",
      "border.join",
      "border.head",
      "border.tail",
      "border.alpha",
      "effects.shadow",
      "effects.innerShadow",
      "effects.glow",
      "effects.softEdge",
      "effects.blur",
      "effects.drop1",
      "effects.drop2",
      "effects.drop3",
      "effects.inner1",
      "effects.inner2",
      "effects.inner3",
      "body.insets",
      "body.anchor",
      "body.wrap",
      "body.autofit",
      "body.vertical",
      "body.columns",
      "text.value",
      "text.alpha",
      "connection.start",
      "connection.end",
      "notes.value",
      "templateStyle.id",
      "templateStyle.name",
      "templateStyle.dk1",
      "templateStyle.lt1",
      "templateStyle.dk2",
      "templateStyle.lt2",
      "templateStyle.accent1",
      "templateStyle.accent2",
      "templateStyle.accent3",
      "templateStyle.accent4",
      "templateStyle.accent5",
      "templateStyle.accent6",
      "templateStyle.hlink",
      "templateStyle.folHlink",
      "templateStyle.major",
      "templateStyle.minor",
      "templateStyle.custom",
      "templateStyle.removed",
      "templateStyle.textStyle",
      "show.skipped",
      "transition.value",
      "guides.ruler",
      "guides.layout",
      "layout.flow",
      "layout.gap",
      "layout.padding",
      "layout.align",
      "layout.opacity",
      "layout.width",
      "layout.height",
    ])
    expect(alphaKeys).toEqual(["fills.alpha", "border.alpha", "text.alpha", "layout.opacity"])
  })

  it("lets only a declared field go back to the value its layout, master or style gives", () => {
    const fields = traitNames.flatMap((trait) =>
      Object.keys(traits[trait].fields).flatMap((field) => (inheritable(trait, field) ? [`${trait}.${field}`] : [])),
    )
    expect(fields).toEqual([
      "fills.p0",
      "border.fill",
      "border.width",
      "border.dash",
      "border.cap",
      "border.compound",
      "border.join",
      "border.head",
      "border.tail",
      "body.insets",
      "body.anchor",
      "body.wrap",
      "body.autofit",
      "body.vertical",
      "body.columns",
    ])
  })

  it("keeps a slot it cannot model from a patch inside it, but lets a whole value replace it", () => {
    expect(keptRefuses(["fills"], "fills", "paint")).toBe(false)
    expect(keptRefuses(["fills"], "fills", "p1")).toBe(true)
    expect(keptRefuses(["geometry"], "geometry", "shape")).toBe(false)
    expect(keptRefuses(["box.rot"], "box", "rot")).toBe(true)
    expect(keptRefuses(["effects.shadow"], "effects", "shadow")).toBe(true)
    expect(keptRefuses(["text.color"], "text", "value")).toBe(false)
    expect(keptRefuses([], "fills", "paint")).toBe(false)
  })

  it("gives every kind a closed list of declared traits", () => {
    for (const kind of kinds) for (const trait of kindTraits[kind]) expect(traitNames).toContain(trait)
    expect(kindTraits.group).toEqual(["identity", "box", "effects", "layout"])
    expect(kindTraits.slide).toEqual(["fills", "templateStyle", "show", "transition", "guides"])
    expect(kindTraits.notes).toEqual(["notes"])
  })
})
