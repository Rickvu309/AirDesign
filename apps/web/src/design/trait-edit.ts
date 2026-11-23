import { registerScope, type Register, type Scope } from "@airdesign/document"
import type { ReadShape } from "@airdesign/pptx"
import { textValue } from "@airdesign/render"
import { designedParts } from "@/editing/index-deck"
import { valueStorable } from "@/editing/slide-paint"

type Parts = ReadonlyMap<string, Uint8Array>

const openings = new WeakMap<Parts, ReturnType<typeof designedParts>>()

function indexed(parts: Parts, register: Register): Register {
  const opening = openings.get(parts) ?? designedParts(parts)
  openings.set(parts, opening)
  const stored = register.index?.templateStyles
  const fresh = opening.templateStyles ?? []
  const templateStyles =
    stored === undefined
      ? undefined
      : [
          ...stored.map((style) => fresh.find((each) => each.id === style.id) ?? style),
          ...fresh.filter((style) => stored.every((each) => each.id !== style.id)),
        ]
  return {
    ...register,
    index: {
      ...opening,
      total: opening.elements.length,
      pages: [],
      ...(templateStyles === undefined ? {} : { templateStyles }),
    },
  }
}

export function deviceScope(parts: Parts, register: Register): Scope {
  return registerScope(indexed(parts, register))
}

export function valueFits(parts: Parts, shape: ReadShape | undefined, value: string): boolean {
  if (shape === undefined) return false
  return valueStorable(parts, shape, textValue(value))
}
