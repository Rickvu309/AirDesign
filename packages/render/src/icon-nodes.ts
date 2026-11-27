import { useEffect, useState } from "react"

export type IconNode = readonly [string, Readonly<Record<string, unknown>>, (readonly IconNode[])?]

type IconModule = { readonly __iconData?: { readonly node: readonly IconNode[] } }

type Loaders = Readonly<Record<string, () => Promise<unknown>>>

let loaders: Promise<Loaders> | undefined
function iconLoaders(): Promise<Loaders> {
  loaders ??= import("lucide-react/dynamicIconImports.mjs").then(
    (module) => module.default as Loaders,
    (error: unknown) => {
      loaders = undefined
      throw error
    },
  )
  return loaders
}
const prefix = "lucide/"
const held = new Map<string, readonly IconNode[] | null>()
const pending = new Map<string, Promise<void>>()

const lucideName = (name: string) => (name.startsWith(prefix) ? name.slice(prefix.length) : name)

export function iconNodes(name: string): readonly IconNode[] | undefined {
  return held.get(lucideName(name)) ?? undefined
}

export function loadIcon(name: string): Promise<void> {
  const key = lucideName(name)
  if (held.has(key)) return Promise.resolve()
  let load = pending.get(key)
  if (load === undefined) {
    load = iconLoaders()
      .then((found) => (Object.hasOwn(found, key) ? found[key]?.() : undefined))
      .then((module) => void held.set(key, (module as IconModule | undefined)?.__iconData?.node ?? null))
      .catch(() => void held.set(key, null))
    pending.set(key, load)
  }
  return load
}

export function useIcons(names: readonly string[]): boolean {
  const key = [...new Set(names)].sort().join(" ")
  const [, settle] = useState(0)
  const missing = key === "" ? [] : key.split(" ").filter((name) => !held.has(lucideName(name)))
  useEffect(() => {
    if (missing.length === 0) return
    let current = true
    void Promise.all(missing.map(loadIcon)).then(() => current && settle((count) => count + 1))
    return () => {
      current = false
    }
  }, [key])
  return missing.length === 0
}
