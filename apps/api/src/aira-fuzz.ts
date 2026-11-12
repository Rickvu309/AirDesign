import { Replay } from "./aira-replay.js"
import type { AiraSettings } from "./aira.js"

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
        headers: ["cf-ipcountry: VN"],
        fields: { deck, messages: [{ role: "user", content: "Fuzz" }] },
      },
    ],
    "POST /decks/undo": [
      { shape: "json" as const, answers: 200, says: '"refusal":"run-fenced"', fields: { deck, runId: "fuzzrun" } },
    ],
  }
}
