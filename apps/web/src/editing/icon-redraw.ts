import { iconOfPart } from "@airdesign/pptx"

const hundredthsPerUnit = 100

const rootStroke = /^(<svg [^>]*?\bstroke=")#[0-9A-Fa-f]{6}("[^>]*?\bstroke-width=")[0-9.]+(")/

export function strokeWidth(weight: number): string {
  return String(weight / hundredthsPerUnit)
}

export function redrawnIcon(part: string, parts: ReadonlyMap<string, Uint8Array>): Uint8Array | undefined {
  const icon = part.endsWith(".svg") ? iconOfPart(part) : null
  if (icon === null) return undefined
  for (const [name, bytes] of parts) {
    if (!name.endsWith(".svg") || iconOfPart(name)?.name !== icon.name) continue
    const svg = new TextDecoder().decode(bytes)
    if (!rootStroke.test(svg)) continue
    const drawn = svg.replace(rootStroke, `$1#${icon.color.hex}$2${strokeWidth(icon.weight)}$3`)
    return new TextEncoder().encode(drawn)
  }
  return undefined
}
