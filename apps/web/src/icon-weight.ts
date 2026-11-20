import { iconOfPart } from "@airdesign/pptx"

const hundredthsPerUnit = 100

const rootWidth = /^(<svg [^>]*?\bstroke-width=")[0-9.]+(")/

export function strokeWidth(weight: number): string {
  return String(weight / hundredthsPerUnit)
}

export function reweighedIcon(part: string, parts: ReadonlyMap<string, Uint8Array>): Uint8Array | undefined {
  const icon = part.endsWith(".svg") ? iconOfPart(part) : null
  if (icon === null) return undefined
  for (const [name, bytes] of parts) {
    if (!name.endsWith(".svg") || iconOfPart(name)?.name !== icon.name) continue
    const svg = new TextDecoder().decode(bytes)
    if (rootWidth.test(svg)) return new TextEncoder().encode(svg.replace(rootWidth, `$1${strokeWidth(icon.weight)}$2`))
  }
  return undefined
}
