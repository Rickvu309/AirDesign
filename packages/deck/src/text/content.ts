import type {Element} from "../model.ts"
import type {NativeElement} from "./native-v3.ts"
import type {TextBody, TextStyle} from "./body.ts"

export function bodyText(body: TextBody): string {
  return body.paragraphs.map(paragraph => paragraph.runs.map(run => run.kind === "break" ? "\n" : run.text).join("")).join("\n")
}
export function bodyStyles(body: TextBody): TextStyle[] {
  return body.paragraphs.flatMap(paragraph => [...paragraph.runs.map(run => run.style), paragraph.endStyle])
}
export function textElements(elements: readonly (Element | NativeElement)[]): (Element | NativeElement)[] {
  return elements.flatMap(element => element.kind === "group" ? [element, ...textElements(element.children)] : [element])
}
