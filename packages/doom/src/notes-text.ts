import type { Text } from "./text.js"

export function notesText(chars: string): Text {
  return { chars, spans: [], paras: chars.split("\n").map(() => ({})), style: "body", resize: "height", alignV: "top" }
}
