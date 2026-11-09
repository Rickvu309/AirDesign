import type {Element} from "./model.ts"
import type {NativeElement} from "./text/native-v3.ts"

export function flatten(elements: readonly Element[]): Element[]
export function flatten(elements: readonly NativeElement[]): NativeElement[]
export function flatten(elements: readonly (Element | NativeElement)[]): (Element | NativeElement)[]
export function flatten(elements: readonly (Element | NativeElement)[]): (Element | NativeElement)[] {
  return elements.flatMap(element => element.kind === "group" ? [element, ...flatten(element.children)] : [element])
}
