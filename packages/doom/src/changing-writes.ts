import type { Doom, Node, Write } from "./doom.js"
import type { NodeId } from "./ids.js"
import { readWrite } from "./read-write.js"
import { isRefusal } from "./refusal.js"
import { type Theme, type ThemeKey, themeValueAt, withThemeValue } from "./theme.js"

type Values = Readonly<Record<string, unknown>>

export function sameValue(one: unknown, two: unknown): boolean {
  if (one === two) return true
  if (typeof one !== "object" || typeof two !== "object" || one === null || two === null) return false
  if (Array.isArray(one) || Array.isArray(two)) {
    if (!Array.isArray(one) || !Array.isArray(two) || one.length !== two.length) return false
    return one.every((each, at) => sameValue(each, two[at]))
  }
  const named = (value: object) => Object.entries(value).filter(([, each]) => each !== undefined)
  const ones = named(one)
  return ones.length === named(two).length && ones.every(([key, each]) => sameValue(each, (two as Values)[key]))
}

function valueAt(values: Values, key: string): unknown {
  if (key.startsWith("theme.")) return themeValueAt(values.theme as Theme, key as ThemeKey)
  return key === "parent" ? values.parent : (values[key] ?? null)
}

function withValue(values: Values, key: string, value: unknown): Values {
  if (key.startsWith("theme.")) return { ...values, theme: withThemeValue(values.theme as Theme, key as never, value) }
  return { ...values, [key]: value }
}

const propertyOf = (prop: string) => (prop.startsWith("theme") ? "theme" : prop)

export function changingWrites(doom: Doom, writes: readonly Write[]): readonly Write[] {
  const now = new Map<NodeId, Values>()
  const judged = new Map<Write, string>()
  const kept = writes.filter((write) => {
    const values: Values | undefined = now.get(write.node) ?? (doom.nodes.get(write.node) as Node | undefined)
    if (values === undefined) return true
    const read = readWrite(write, doom)
    if (isRefusal(read)) return true
    if (read.prop === "type") return false
    if (read.prop !== "parent" && values.parent === null) return true
    if (read.prop.startsWith("theme.") && values.theme === undefined) return true
    if (sameValue(valueAt(values, read.prop), read.value)) return false
    now.set(write.node, withValue(values, read.prop, read.value))
    judged.set(write, propertyOf(read.prop))
    return true
  })
  const changed = kept.filter((write) => {
    const property = judged.get(write)
    if (property === undefined) return true
    const was = doom.nodes.get(write.node) as Values
    return !sameValue(valueAt(was, property), valueAt(now.get(write.node)!, property))
  })
  return changed
}
