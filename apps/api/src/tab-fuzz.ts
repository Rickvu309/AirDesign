import { doomFuzzGood } from "./doom-fuzz.js"

const findings = [{ code: "overflow", node: "258.7", needed: 86.4, room: 64.8, size: 28, height: 93.6 }]

function landed(fields: Record<string, unknown>) {
  return [{ shape: "json" as const, answers: 200, says: '"ok":true', fields }]
}

export function tabFuzzGood(deck: string) {
  return {
    "POST /decks/watch": landed({ deck, cursor: null }),
    "POST /decks/findings": landed({ deck, revision: 0, findings }),
    ...doomFuzzGood(`${deck}doom`),
  }
}
