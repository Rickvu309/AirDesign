import { child, inside, type Held } from "./markup-held.js"
import { paintAttribute } from "./paint-color.js"

export const textStylesUri = "{6E3B1F4A-9C2D-4B7E-A815-3F0D2C9B7A61}"

export function textStyleNames(master: Held): ReadonlyMap<string, string> {
  const list = child(master, "p:extLst")
  const extension =
    list === undefined ? undefined : inside(list).find((each) => paintAttribute(each, "uri") === textStylesUri)
  const styles = extension === undefined ? undefined : child({ ...list!, element: extension }, "ad:textStyles")
  const names = new Map<string, string>()
  for (const each of styles === undefined ? [] : inside(styles)) {
    const ref = paintAttribute(each, "ref")
    const name = paintAttribute(each, "name")?.trim()
    if (each.kind === "ad:style" && ref !== null && name !== undefined && name !== "") names.set(ref, name)
  }
  return names
}
