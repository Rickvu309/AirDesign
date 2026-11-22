import { countryHeader } from "@airdesign/catalog"

import { Replay } from "./aira-replay.js"
import type { AiraSettings } from "../aira/aira.js"

export const fuzzAira: AiraSettings = {
  on: true,
  key: "test-key-not-real",
  secret: "fuzz-user-secret-not-real-0123456789abcdef",
  transport: new Replay().transport,
  log: () => undefined,
}

export function fuzzGood(deck: string) {
  return {
    "POST /aira/turn": [
      {
        shape: "json" as const,
        answers: 200,
        says: '"type":"end","ok":true',
        headers: [`${countryHeader}: VN`],
        fields: { deck, messages: [{ role: "user", content: "Fuzz" }], ask: "fuzzask" },
      },
    ],
    "POST /aira/usage": [{ shape: "json" as const, answers: 200, says: '"ok":true', fields: {} }],
    "POST /aira/credits": [{ shape: "json" as const, answers: 200, says: '"ok":true', fields: {} }],
    "POST /aira/credits/reset": [
      { shape: "json" as const, answers: 409, says: '"ok":false', fields: { once: "fuzzreset" } },
    ],
    "POST /aira/credits/auto-reset": [
      { shape: "json" as const, answers: 200, says: '"ok":true', fields: { enabled: false } },
    ],
    "POST /aira/stop": [{ shape: "json" as const, answers: 200, says: '"ok":true', fields: { ask: "fuzzask" } }],
    "POST /decks/undo": [
      { shape: "json" as const, answers: 200, says: '"refusal":"run-fenced"', fields: { deck, runId: "fuzzrun" } },
    ],
  }
}
