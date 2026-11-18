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
  Expect<Same<FieldName<"fills">, "p0" | "p1" | "p2" | "p3" | "alpha">>,
  Expect<Same<FieldValue<"fills", "alpha">, Alpha>>,
  Expect<Same<WireField<"fills">, "paint">>,
  Expect<Same<FieldName<"line">, "width" | "fill" | "dash" | "cap" | "compound" | "join" | "head" | "tail" | "alpha">>,
  Expect<null extends WireAgent<"line", "width"> ? true : false>,
  Expect<"none" | "accent2" extends WireAgent<"line", "fill"> ? true : false>,
  Expect<null extends WireAgent<"fills", "paint"> ? true : false>,
  Expect<null extends WireAgent<"box", "x"> ? false : true>,
  Expect<"none" | "group" | "accent1" extends WireAgent<"fills", "paint"> ? true : false>,
  Expect<Same<WireField<"box">, "x" | "y" | "w" | "h" | "rot" | "flipH" | "flipV" | "align" | "distribute">>,
  Expect<"center" extends WireAgent<"box", "align"> ? true : false>,
  Expect<Same<WireAgent<"box", "x">, number>>,
  Expect<Same<WireAgent<"text", "value">, string>>,
  Expect<Same<HasAlpha, true>>,
  Expect<"table.value" extends FieldKey ? true : false>,
  Expect<"fills.p3" extends FieldKey ? true : false>,
  Expect<"line.width" extends FieldKey ? true : false>,
  Expect<"line.alpha" extends FieldKey ? true : false>,
  Expect<Same<WireField<"line">, Exclude<FieldName<"line">, "alpha">>>,
]

describe("the one table of traits", () => {
  it("declares how the traits inherit in PowerPoint", () => {
    expect(Object.fromEntries(traitNames.map((name) => [name, traits[name].inherits]))).toEqual({
      identity: "own",
      link: "own",
      box: "whole",
      geometry: "whole",
      fills: "whole",
      line: "field",
      effects: "whole",
      body: "field",
      text: "run",
      image: "own",
      crop: "own",
      connection: "own",
      table: "own",
      notes: "own",
      theme: "own",
      template: "own",
      show: "own",
      transition: "own",
    })
  })

  it("holds only the fields that are live", () => {
    expect(traitNames.flatMap(fieldKeys)).toEqual([
      "identity.name",
      "identity.alt",
      "identity.hidden",
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
      "fills.alpha",
      "line.fill",
      "line.width",
      "line.dash",
      "line.cap",
      "line.compound",
      "line.join",
      "line.head",
      "line.tail",
      "line.alpha",
      "effects.shadow",
      "effects.glow",
      "effects.softEdge",
      "body.insets",
      "body.anchor",
      "body.wrap",
      "body.autofit",
      "body.vertical",
      "body.columns",
      "text.value",
      "text.alpha",
      "image.source",
      "image.mode",
      "image.alpha",
      "image.recolor",
      "image.blur",
      "image.overlay",
      "crop.rect",
      "connection.start",
      "connection.end",
      "table.value",
      "notes.value",
      "theme.name",
      "theme.dk1",
      "theme.lt1",
      "theme.dk2",
      "theme.lt2",
      "theme.accent1",
      "theme.accent2",
      "theme.accent3",
      "theme.accent4",
      "theme.accent5",
      "theme.accent6",
      "theme.hlink",
      "theme.folHlink",
      "theme.major",
      "theme.minor",
      "theme.custom",
      "theme.removed",
      "theme.textStyle",
      "template.id",
      "show.skipped",
      "transition.value",
    ])
    expect(alphaKeys).toEqual(["fills.alpha", "line.alpha", "text.alpha", "image.alpha"])
  })

  it("lets only a declared field go back to the value its layout, master or style gives", () => {
    const fields = traitNames.flatMap((trait) =>
      Object.keys(traits[trait].fields).flatMap((field) => (inheritable(trait, field) ? [`${trait}.${field}`] : [])),
    )
    expect(fields).toEqual([
      "fills.p0",
      "line.fill",
      "line.width",
      "line.dash",
      "line.cap",
      "line.compound",
      "line.join",
      "line.head",
      "line.tail",
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
    expect(kindTraits.group).toEqual(["identity", "box", "effects"])
    expect(kindTraits.slide).toEqual(["fills", "template", "show", "transition"])
    expect(kindTraits.notes).toEqual(["notes"])
  })
})
