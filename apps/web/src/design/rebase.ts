import type { Desc, SetChange } from "@airdesign/document"
import type { PanelControl } from "./panel"

type Loose = Readonly<Record<string, unknown>>

function same(one: unknown, other: unknown): boolean {
  return JSON.stringify(one) === JSON.stringify(other)
}

function looseOf(value: unknown): Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Loose) : {}
}

function keyed(field: (name: string) => Desc | undefined, base: unknown, sent: unknown, latest: unknown): Loose {
  const was = looseOf(base)
  const now = looseOf(latest)
  const changed = Object.entries(looseOf(sent)).flatMap(([name, value]) => {
    if (same(value, was[name])) return []
    const desc = field(name)
    return [[name, desc === undefined ? value : rebased(desc, was[name], value, now[name])] as const]
  })
  return { ...now, ...Object.fromEntries(changed) }
}

function caseOf(cases: Readonly<Record<string, Desc>>, value: unknown): string | undefined {
  return Object.keys(looseOf(value)).find((name) => Object.hasOwn(cases, name))
}

export function rebased(desc: Desc, base: unknown, sent: unknown, latest: unknown): unknown {
  if (same(sent, base)) return latest
  if (desc.kind === "record") return keyed((name) => desc.fields[name], base, sent, latest)
  if (desc.kind === "named") return keyed(() => desc.item, base, sent, latest)
  if (desc.kind === "union") {
    const chosen = caseOf(desc.cases, sent)
    const inner = chosen === undefined ? undefined : desc.cases[chosen]
    if (inner === undefined || chosen === undefined) return sent
    if (caseOf(desc.cases, base) !== chosen || caseOf(desc.cases, latest) !== chosen) return sent
    return { [chosen]: rebased(inner, looseOf(base)[chosen], looseOf(sent)[chosen], looseOf(latest)[chosen]) }
  }
  if (desc.kind === "list" && Array.isArray(base) && Array.isArray(sent) && Array.isArray(latest)) {
    if (base.length !== sent.length || sent.length !== latest.length) return sent
    return sent.map((item: unknown, at) => rebased(desc.item, base[at], item, latest[at]))
  }
  return sent
}

export function rebasedChange(controls: readonly PanelControl[], control: PanelControl, value: unknown): SetChange {
  const now = controls.find((each) => each.trait === control.trait && each.field === control.field)
  return now === undefined ? control.change(value) : now.change(rebased(control.desc, control.value, value, now.value))
}
