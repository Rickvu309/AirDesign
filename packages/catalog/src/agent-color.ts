import {
  bareTransforms,
  mappedSlots,
  readColor,
  templateColors,
  valuedTransforms,
  type Color,
  type ColorTransform,
} from "@airdesign/document"

const agentNumber = "-?[0-9]+(?:\\.[0-9]+)?"
function slotPattern(slots: readonly string[]): string {
  const groups = new Map<string, string[]>()
  for (const slot of slots) {
    const [, stem = slot, digit = ""] = /^(.*?)([0-9]?)$/.exec(slot) ?? []
    groups.set(stem, [...(groups.get(stem) ?? []), digit])
  }
  return [...groups]
    .map(([stem, digits]) => (digits.length > 1 ? `${stem}[${digits.join("")}]` : `${stem}${digits.join("")}`))
    .join("|")
}

function valuedPattern(ops: readonly string[]): string {
  const stems = ops.filter((op) => ops.includes(`${op}Mod`) && ops.includes(`${op}Off`))
  const single = ops.filter((op) => !stems.some((stem) => [stem, `${stem}Mod`, `${stem}Off`].includes(op)))
  return [`(?:${stems.join("|")})(?:Mod|Off)?`, ...single].join("|")
}

export const colorPattern = `(?:#[0-9A-Fa-f]{6}|${slotPattern([...templateColors, ...mappedSlots])})(?: (?:${valuedPattern(valuedTransforms)}) ${agentNumber}| (?:${bareTransforms.join("|")}))*`

const colorExact = new RegExp(`^${colorPattern}$`)

export const hexPattern = "#[0-9A-Fa-f]{6}"

const hexExact = new RegExp(`^${hexPattern}$`)

export function readAgentHex(raw: unknown): string | null {
  return typeof raw === "string" && hexExact.test(raw) ? raw.slice(1).toUpperCase() : null
}

function bareWord(word: string): boolean {
  return (bareTransforms as readonly string[]).includes(word)
}

export function readAgentColor(raw: unknown): Color | null {
  if (typeof raw !== "string" || !colorExact.test(raw)) return null
  const [base = "", ...words] = raw.split(" ")
  const transforms: ColorTransform[] = []
  for (let at = 0; at < words.length; at += 1) {
    const op = words[at] ?? ""
    if (bareWord(op)) transforms.push({ op } as ColorTransform)
    else transforms.push({ op, val: Math.round(Number(words[(at += 1)]) * 1_000) } as ColorTransform)
  }
  const color = base.startsWith("#") ? { rgb: base.slice(1).toUpperCase() } : { scheme: base }
  return readColor(transforms.length === 0 ? color : { ...color, transforms }) ?? null
}
