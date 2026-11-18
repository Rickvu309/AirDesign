import { expect, it } from "vitest"
import { readAgentEdit } from "./index.js"
import { readAddChange, readSetChange } from "./set-wire.js"

const target = "258.7"

function hashed(digits: string): `#${string}` {
  return `#${digits}`
}

it("reads an accepted name of a field as the field the tools advertise, in a set and in an add", () => {
  const canonical = readSetChange({ op: "set", target, text: { lineHeight: 150 } })
  expect(readSetChange({ op: "set", target, text: { lineSpacing: 150 } })).toEqual(canonical)
  expect(canonical).toMatchObject({ ok: true, change: { text: { lineHeight: 150_000 } } })
  const added = { op: "add", kind: "shape", slide: "258", box: { x: 0, y: 0, w: 10, h: 10 } }
  const addedCanonical = readAddChange({ ...added, text: { value: "Hi", lineHeight: 150 } })
  expect(addedCanonical).toMatchObject({ ok: true })
  expect(readAddChange({ ...added, text: { value: "Hi", lineSpacing: 150 } })).toEqual(addedCanonical)
})

it("refuses both spellings of one field in one change and names the field the tools advertise", () => {
  expect(readSetChange({ op: "set", target, text: { lineHeight: 150, lineSpacing: 120 } })).toEqual({
    ok: false,
    refusal: "field",
    field: "text.lineHeight",
  })
  const edit = { deck: "deck", base: 0, changes: [{ op: "set", target, text: { lineHeight: 150, lineSpacing: 120 } }] }
  expect(readAgentEdit(edit)).toEqual({ ok: false, refusal: "field" })
  expect(readAgentEdit({ ...edit, changes: [{ op: "set", target, text: { lineSpacing: 150 } }] })).toMatchObject({
    ok: true,
    changes: [{ op: "set", text: { lineHeight: 150_000 } }],
  })
})

it("reads an agent's fill value, its old trait and field, as the paint of fills", () => {
  const canonical = readSetChange({ op: "set", target, fills: { paint: "accent2" } })
  expect(canonical).toEqual({
    ok: true,
    change: { op: "set", target: { node: target }, fills: { paint: { solid: { scheme: "accent2" } } } },
  })
  expect(readSetChange({ op: "set", target, fill: { value: "accent2" } })).toEqual(canonical)
  expect(readSetChange({ op: "set", target, fill: { value: null } })).toEqual(
    readSetChange({ op: "set", target, fills: { paint: null } }),
  )
  expect(readSetChange({ op: "set", target, fill: { value: { picture: "rocket" } } })).toEqual({
    ok: true,
    change: { op: "set", target: { node: target }, fills: { paint: { image: "rocket" } } },
  })
  expect(readSetChange({ op: "set", target, fill: { value: "accent2" }, fills: { paint: "accent1" } })).toEqual({
    ok: false,
    refusal: "field",
    field: "fills.paint",
  })
  expect(readSetChange({ op: "set", target, fill: { alpha: 50 } })).toEqual({
    ok: false,
    refusal: "field",
    field: "fills.alpha",
  })
})

it("reads an agent's old image and crop fields as fields of fills, joined with what fills already names", () => {
  const old = readSetChange({
    op: "set",
    target,
    image: { recolor: "grayscale", blur: 40 },
    crop: { rect: { l: 10, t: 0, r: 10, b: 0 } },
    fills: { mode: "crop" },
  })
  const canonical = readSetChange({
    op: "set",
    target,
    fills: { mode: "crop", recolor: "grayscale", blur: 40, crop: { l: 10, t: 0, r: 10, b: 0 } },
  })
  expect(canonical).toMatchObject({ ok: true })
  expect(old).toEqual(canonical)
  expect(readSetChange({ op: "set", target, image: { source: "rocket" } })).toEqual(
    readSetChange({ op: "set", target, fills: { source: "rocket" } }),
  )
  expect(readSetChange({ op: "set", target, image: { mode: "fit" }, fills: { mode: "fill" } })).toEqual({
    ok: false,
    refusal: "field",
    field: "fills.mode",
  })
})

it("adds an icon as a shape whose fills hold it, under the old picture kind too", () => {
  const added = { op: "add", slide: "258", icon: "rocket" }
  const shape = readAddChange({ ...added, kind: "shape" })
  expect(shape).toEqual({ ok: true, change: { op: "add", kind: "shape", slide: "258", icon: "rocket" } })
  expect(readAddChange({ ...added, kind: "picture" })).toEqual(shape)
  expect(readAddChange({ op: "add", kind: "picture", slide: "258" })).toEqual({
    ok: false,
    refusal: "field",
    field: "icon",
  })
  expect(readAddChange({ ...added, kind: "shape", text: { value: "Hi" } })).toEqual({
    ok: false,
    refusal: "field",
    field: "text",
  })
})

it("reads an agent's line, the border's old name, as the border, with every field", () => {
  const border = {
    width: 3,
    fill: "accent2",
    dash: "sysDot",
    cap: "rnd",
    compound: "dbl",
    join: "bevel",
    head: { type: "oval", width: "lg", length: "sm" },
    tail: { type: "stealth", width: "lg", length: "lg" },
  }
  const canonical = readSetChange({ op: "set", target, border })
  expect(canonical).toMatchObject({ ok: true, change: { border: { width: 38_100, compound: "dbl" } } })
  expect(readSetChange({ op: "set", target, line: border })).toEqual(canonical)
  expect(readSetChange({ op: "set", target, line: { fill: null } })).toEqual(
    readSetChange({ op: "set", target, border: { fill: null } }),
  )
  const edit = { deck: "deck", base: 0, changes: [{ op: "set", target, line: { width: 2 } }] }
  expect(readAgentEdit(edit)).toMatchObject({ ok: true, changes: [{ op: "set", border: { width: 25_400 } }] })
})

it("refuses the border spelled both ways in one change and names the field the tools advertise", () => {
  expect(readSetChange({ op: "set", target, line: { width: 2 }, border: { width: 3 } })).toEqual({
    ok: false,
    refusal: "field",
    field: "border.width",
  })
  expect(readSetChange({ op: "set", target, line: { width: 2 }, border: { dash: "dot" } })).toEqual(
    readSetChange({ op: "set", target, border: { width: 2, dash: "dot" } }),
  )
  expect(readSetChange({ op: "set", target, line: { width: 1585 } })).toEqual({
    ok: false,
    refusal: "field",
    field: "border.width",
  })
})

it("reads an agent's theme and template, the template style's old names, and its old addresses as the template style", () => {
  const colors = { accent1: hashed("C00000"), major: "Georgia", custom: [{ name: "Coral", color: hashed("FF6600") }] }
  const every = readSetChange({ op: "set", target: "deck.templateStyles", templateStyle: colors })
  expect(every).toMatchObject({
    ok: true,
    change: { target: { node: "deck.templateStyles" }, templateStyle: { accent1: "C00000", major: "Georgia" } },
  })
  expect(readSetChange({ op: "set", target: "deck.theme", theme: colors })).toEqual(every)
  expect(readSetChange({ op: "set", target: "deck.template2", theme: { name: "Night" } })).toEqual(
    readSetChange({ op: "set", target: "deck.templateStyle2", templateStyle: { name: "Night" } }),
  )
  const chosen = readSetChange({ op: "set", target: "258", templateStyle: { id: "ppt/theme/theme2.xml" } })
  expect(chosen).toMatchObject({ ok: true, change: { templateStyle: { id: "ppt/theme/theme2.xml" } } })
  expect(readSetChange({ op: "set", target: "258", template: { id: "ppt/theme/theme2.xml" } })).toEqual(chosen)
  const edit = { deck: "deck", base: 0, changes: [{ op: "set", target: "deck.theme", theme: { minor: "Verdana" } }] }
  expect(readAgentEdit(edit)).toMatchObject({
    ok: true,
    changes: [{ op: "set", target: { node: "deck.templateStyles" }, templateStyle: { minor: "Verdana" } }],
  })
})

it("refuses the template style spelled two ways in one change and names the field the tools advertise", () => {
  const twice = {
    op: "set",
    target: "deck.templateStyles",
    theme: { dk1: hashed("000000") },
    templateStyle: { dk1: hashed("111111") },
  }
  expect(readSetChange(twice)).toEqual({ ok: false, refusal: "field", field: "templateStyle.dk1" })
  expect(readSetChange({ op: "set", target: "258", template: { id: "a" }, templateStyle: { id: "b" } })).toEqual({
    ok: false,
    refusal: "field",
    field: "templateStyle.id",
  })
})
