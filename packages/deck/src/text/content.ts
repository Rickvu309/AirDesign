import type {TextBody, TextStyle} from "./body.ts"

export function bodyText(body: TextBody): string {
  return body.paragraphs.map(paragraph => paragraph.runs.map(run => run.kind === "break" ? "\n" : run.text).join("")).join("\n")
}
export function bodyStyles(body: TextBody): TextStyle[] {
  return body.paragraphs.flatMap(paragraph => [...paragraph.runs.map(run => run.style), paragraph.endStyle])
}
