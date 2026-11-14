import {
  bytesOf,
  designBytes,
  designKeys,
  type Color,
  type Design,
  type DesignKey,
  type ElementRead,
  type FillRead,
  type IndexElement,
  type Read,
  type ShadowRead,
  type Shown,
  type TraitReads,
} from "@airdesign/document"

const emuPerPoint = 12_700
const anglePerDegree = 60_000
const hundredthsPerPoint = 100

function tenths(value: number): number {
  return Math.round(value * 10) / 10
}

function percent(value: number): string {
  return String(Math.round(value / 100) / 10)
}

function baseOf(color: Color): string {
  if ("scheme" in color) return color.scheme
  if ("rgb" in color) return `#${color.rgb}`
  if ("system" in color) return `#${color.last}`
  return color.preset
}

export function agentColor(color: Color): string {
  const transforms = (color.transforms ?? []).map((transform) =>
    "val" in transform ? `${transform.op} ${percent(transform.val)}` : transform.op,
  )
  return [baseOf(color), ...transforms].join(" ")
}

function agentFill(fill: FillRead): string {
  if (fill === "picture" || fill === "group") return fill
  if ("color" in fill) return agentColor(fill.color)
  if ("gradient" in fill) return `gradient ${fill.gradient.map(agentColor).join(", ")}`
  return `pattern ${fill.pattern}`
}

function agentShadow(shadow: ShadowRead): string {
  const parts = [
    `blur ${String(tenths(shadow.blur / emuPerPoint))}`,
    `distance ${String(tenths(shadow.distance / emuPerPoint))}`,
    `direction ${String(tenths(shadow.direction / anglePerDegree))}`,
  ]
  return shadow.color === null ? parts.join(" ") : `${parts.join(" ")} ${agentColor(shadow.color)}`
}

type Agent = { readonly [Key in DesignKey]: (read: NonNullable<TraitReads[Key]>["value"]) => Shown[0] }

const agent: Agent = {
  geometry: (value) => value,
  fill: agentFill,
  "line.width": (value) => tenths(value / emuPerPoint),
  "line.fill": agentFill,
  "line.dash": (value) => value,
  "line.head": (value) => value,
  "line.tail": (value) => value,
  "effects.shadow": agentShadow,
  "text.size": (value) => tenths(value / hundredthsPerPoint),
  "text.color": agentColor,
  "text.font": (value) => value,
  "text.bold": (value) => value,
  "body.anchor": (value) => value,
  "body.autofit": (value) => value,
  "body.vertical": (value) => value,
  "box.rot": (value) => tenths(value / anglePerDegree),
  "box.flipH": (value) => value,
  "box.flipV": (value) => value,
}

function shownOf<Key extends DesignKey>(key: Key, read: Read<NonNullable<TraitReads[Key]>["value"]>): Shown {
  const value = agent[key](read.value)
  return read.source === undefined ? [value] : [value, read.source]
}

export function designOf(read: ElementRead): Pick<IndexElement, "role" | "design" | "kept"> {
  const design: Partial<Record<DesignKey, Shown>> = {}
  for (const key of designKeys) {
    const field = read.reads[key] as Read<never> | undefined
    if (field === undefined) continue
    const shown = shownOf(key, field)
    const trial = { ...design, [key]: shown }
    if (bytesOf(JSON.stringify(trial)) > designBytes) break
    design[key] = shown
  }
  const written: Design = design
  return {
    ...(read.role === undefined ? {} : { role: read.role }),
    ...(Object.keys(written).length === 0 ? {} : { design: written }),
    ...(read.kept.length === 0 ? {} : { kept: read.kept }),
  }
}
