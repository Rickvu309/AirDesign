import type { Design, DesignKey, ElementPatch, FieldEdit, Shown } from "@airdesign/document"

const altLength = 60

function altShown(alt: string): string {
  const trimmed = alt.trim()
  return trimmed.length > altLength ? `${trimmed.slice(0, altLength - 1)}…` : trimmed
}

const flagShown = (value: boolean) => (value ? true : null)

export const identityAgents = {
  "identity.alt": (value: string) => value,
  "identity.hidden": (value: boolean) => value,
  "identity.locked": (value: boolean) => value,
  "identity.mask": (value: boolean) => value,
} as const

function folded<V>(
  design: Design,
  key: DesignKey,
  edit: FieldEdit<V> | undefined,
  shown: (value: V) => Shown[0] | null,
): Design {
  if (edit === undefined || edit === "opening") return design
  const rest: Design = Object.fromEntries(Object.entries(design).filter(([each]) => each !== key))
  const value = edit === "inherit" ? null : shown(edit.set)
  return value === null ? rest : { ...rest, [key]: [value] }
}

export function foldIdentity(design: Design, identity: ElementPatch["identity"]): Design {
  let next = folded(design, "identity.alt", identity?.alt, (value) => (value.trim() === "" ? null : altShown(value)))
  next = folded(next, "identity.hidden", identity?.hidden, flagShown)
  next = folded(next, "identity.locked", identity?.locked, flagShown)
  return folded(next, "identity.mask", identity?.mask, flagShown)
}
