import { paragraphText, textValue } from "./paragraph-edit.js"

function lines(text: string): readonly string[] {
  return textValue(text).flatMap((paragraph) => paragraphText(paragraph).split(/\r\n|[\r\n\v\f\u2028\u2029]/))
}

export function isBlank(text: string): boolean {
  return lines(text).every((line) => line.trim() === "")
}

export function nameOf(text: string, fallback: string): string {
  return (
    lines(text)
      .find((line) => line.trim() !== "")
      ?.trim() ?? fallback
  )
}
