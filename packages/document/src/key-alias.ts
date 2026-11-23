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
