import { bytesOf, limits } from "./limits.js"
import { type Reader, reject, wrongForm } from "./read-kit.js"

const breaks = /\s*[\t\r\n\u2028\u2029]\s*/g
const control = /[\u0000-\u001f\u007f-\u009f]/g
const loneSurrogate = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g

export function sourceLine(raw: string): string {
  const clean = raw.replace(breaks, " ").replace(control, "").replace(loneSurrogate, "").trim()
  let kept = ""
  let size = 0
  for (const char of clean) {
    size += bytesOf(char)
    if (size > limits.source) break
    kept += char
  }
  return kept.trimEnd()
}

export const readSource: Reader<string> = (raw) => {
  if (typeof raw !== "string") return wrongForm("A string.")
  return bytesOf(raw) > limits.valueBytes ? reject("limit") : sourceLine(raw)
}
