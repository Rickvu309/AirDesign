import { Replay } from "./aira-replay.js"
import type { AiraSettings } from "./aira.js"

export const airaFuzzSettings: AiraSettings = {
  on: true,
  key: "test-key-not-real",
  secret: "fuzz-user-secret-not-real-0123456789abcdef",
  transport: new Replay().transport,
  log: () => undefined,
}

export const airaFuzzGood = {
  "POST /aira/turn": [
    {
      shape: "json" as const,
      answers: 200,
      says: '"ok":true',
      headers: ["cf-ipcountry: VN"],
      fields: { text: "Fuzz" },
    },
  ],
}
