import { arrowOf, type GestureRow, type Keys, type Pointing } from "@airdesign/render"
import { shortcutCopy } from "@/copy/shortcut-copy"

export type KeyPlatform = "mac" | "other"

export type Caps = readonly string[]

type ChordName = "ctrl" | "alt" | "shift" | "mod" | "meta"

const chordOrder: Readonly<Record<KeyPlatform, readonly ChordName[]>> = {
  mac: ["ctrl", "alt", "shift", "mod", "meta"],
  other: ["mod", "ctrl", "meta", "alt", "shift"],
}

const keyNames: Readonly<Partial<Record<string, string>>> = shortcutCopy.keyNames

const macKeyNames: Readonly<Partial<Record<string, string>>> = shortcutCopy.macKeyNames

export function keyPlatform(agent: string): KeyPlatform {
  return /Mac|iPhone|iPad/.test(agent) ? "mac" : "other"
}

function chordCaps(chord: Partial<Record<ChordName, true>>, platform: KeyPlatform): string[] {
  const signs = shortcutCopy.chord[platform]
  return [...new Set(chordOrder[platform].filter((name) => chord[name] === true).map((name) => signs[name]))]
}

function keyName(keys: Keys, platform: KeyPlatform): string {
  const name = "code" in keys ? (/^(?:Key[A-Z]|Digit\d)$/.test(keys.code) ? keys.code.slice(-1) : keys.code) : keys.key
  const named = (platform === "mac" ? macKeyNames[name] : undefined) ?? keyNames[name]
  return named ?? (name.length === 1 ? name.toUpperCase() : name)
}

function pointingCaps(pointing: Pointing, platform: KeyPlatform): Caps {
  const words = shortcutCopy.pointing
  const verb =
    pointing.double === true
      ? words.double
      : pointing.hover === true
        ? words.hover
        : pointing.drag
          ? words.drag
          : words.click
  return [...chordCaps(pointing, platform), [verb, words[pointing.on]].filter((word) => word !== "").join(" ")]
}

function arrowKey(keys: Keys): boolean {
  return "key" in keys && arrowOf(keys.key) !== null
}

function digitKey(keys: Keys): boolean {
  return "key" in keys && /^\d$/.test(keys.key)
}

export function shortcutCaps(row: GestureRow, platform: KeyPlatform): readonly Caps[] {
  const usable = row.keys.filter((keys) => platform === "mac" || keys.meta !== true)
  const arrows = usable.filter(arrowKey)
  const digits = usable.filter(digitKey)
  const gathered = arrows.length === 4 ? arrows : digits.length === 10 ? digits : []
  const first = gathered[0]
  const named =
    first === undefined
      ? []
      : [arrowKey(first) ? [...chordCaps(first, platform), shortcutCopy.arrows] : [shortcutCopy.digits]]
  const caps = [
    ...named,
    ...usable
      .filter((keys) => !gathered.includes(keys))
      .map((keys) => [...chordCaps(keys, platform), keyName(keys, platform)]),
    ...(row.pointing ?? []).map((pointing) => pointingCaps(pointing, platform)),
  ]
  const seen = new Set<string>()
  return caps.filter((each) => {
    const text = each.join(" ")
    if (seen.has(text)) return false
    seen.add(text)
    return true
  })
}
