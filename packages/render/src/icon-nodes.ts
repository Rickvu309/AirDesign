import { useEffect, useState } from "react"
import dynamicIconImports from "lucide-react/dynamicIconImports.mjs"

export type IconNode = readonly [string, Readonly<Record<string, unknown>>, (readonly IconNode[])?]

type IconModule = { readonly __iconData?: { readonly node: readonly IconNode[] } }

const loaders: Readonly<Record<string, () => Promise<unknown>>> = dynamicIconImports
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
    const loader = Object.hasOwn(loaders, key) ? loaders[key] : undefined
    load =
      loader === undefined
        ? Promise.resolve().then(() => void held.set(key, null))
        : loader()
            .then((module) => void held.set(key, (module as IconModule).__iconData?.node ?? null))
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
