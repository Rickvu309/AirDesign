import { record } from "./plain-object.js"

type Keyed = Readonly<Record<string, unknown>>

const keyAliases: readonly { readonly alias: string; readonly key: string }[] = [
  { alias: "lineSpacing", key: "lineHeight" },
]

export function canonicalKeys(raw: Keyed): Keyed | null {
  let keyed = raw
  for (const { alias, key } of keyAliases) {
    if (!Object.hasOwn(keyed, alias)) continue
    if (Object.hasOwn(keyed, key)) return null
    keyed = Object.fromEntries(Object.entries(keyed).map(([name, value]) => [name === alias ? key : name, value]))
  }
  return keyed
}

export function namesAlias(value: string): boolean {
  return keyAliases.some(({ alias }) => value.includes(`"${alias}":`))
}

function holdsRenamedKey(value: unknown): boolean {
  return typeof value === "string" && keyAliases.some(({ key }) => value.includes(`"${key}":`))
}

function listed(raw: unknown): readonly unknown[] {
  return Array.isArray(raw) ? raw : []
}

export function opensRenamedKey(command: unknown): boolean {
  const held = record(command)
  const copies = listed(held?.copies).flatMap((copy) => listed(record(copy)?.floor))
  return [held?.element, ...listed(held?.floor), ...copies].some((element) => holdsRenamedKey(record(element)?.value))
}
