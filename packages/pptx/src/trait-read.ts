import { child, inside, type Held } from "./markup-held.js"
import {
  layoutMatch,
  masterMatch,
  sheetFrom,
  type Drawn,
  type DrawnShape,
  type ShapeChain,
  type Sheet,
} from "./paint-sheet.js"

export { propertiesOf } from "./shape-properties.js"

export type Styles = {
  readonly fills: readonly Held[]
  readonly lines: readonly Held[]
  readonly effects: readonly Held[]
}
export type Chain = {
  readonly sheet: Sheet
  readonly layout: Sheet | null
  readonly master: Sheet | null
  readonly theme: Sheet | null
}
const titleTypes = new Set(["title", "ctrTitle"])
const bodyTypes = new Set(["body", "subTitle", "obj"])

export function listLevels(list: Held | undefined, level: number): readonly Held[] {
  if (list === undefined) return []
  return [child(list, `a:lvl${String(level + 1)}pPr`), child(list, "a:defPPr")].flatMap((held) => {
    const defaults = child(held, "a:defRPr")
    return defaults === undefined ? [] : [defaults]
  })
}

export function textStyleKind(placeholder: string | null): string {
  if (placeholder !== null && titleTypes.has(placeholder)) return "p:titleStyle"
  return placeholder !== null && bodyTypes.has(placeholder) ? "p:bodyStyle" : "p:otherStyle"
}

const root = (sheet: Sheet): Held => ({ element: sheet.elements[0]!, children: sheet.children })

export function sheetOf(parts: ReadonlyMap<string, Uint8Array>, part: string | null): Sheet | null {
  const bytes = part === null ? undefined : parts.get(part)
  return part === null || bytes === undefined ? null : sheetFrom(part, bytes)
}

export function stylesOf(theme: Sheet | null): Styles {
  if (theme === null) return { fills: [], lines: [], effects: [] }
  const format = child(child(root(theme), "a:themeElements"), "a:fmtScheme")
  const list = (kind: string) => {
    const found = child(format, kind)
    return found === undefined ? [] : inside(found).map((element) => ({ element, children: theme.children }))
  }
  return { fills: list("a:fillStyleLst"), lines: list("a:lnStyleLst"), effects: list("a:effectStyleLst") }
}

export function ownersOf(item: Drawn | DrawnShape, chain: ShapeChain): readonly Held[] {
  const owners: Held[] = [{ element: item.element, children: chain.sheet.children }]
  const wanted = item.placeholder
  if (wanted === null) return owners
  const above = chain.layout === null ? undefined : layoutMatch(chain.layout, wanted)
  if (above !== undefined && chain.layout !== null)
    owners.push({ element: above.element, children: chain.layout.children, source: "layout" })
  const base = chain.master === null ? undefined : masterMatch(chain.master, above?.placeholder ?? wanted)
  if (base !== undefined && chain.master !== null)
    owners.push({ element: base.element, children: chain.master.children, source: "master" })
  return owners
}
