import { fixture } from "./fixture.js"
import { edit, readDeck } from "./score.js"
import type { SuiteRow } from "./suite.js"

export const readSuite: readonly SuiteRow[] = [
  {
    task: {
      id: "read-then-edit",
      prompt:
        "Read deck noted with airdesign_read_deck, then set its title to North star. The title already says Draft. Send the version that read reports as readAt.",
      deck: () => fixture("noted", [{ element: "title", before: ["Draft"] }]),
      want: {
        calls: 2,
        steps: [
          { name: "read_deck", outcome: "ok" },
          { name: "edit_deck", outcome: "ok" },
        ],
        elements: { title: ["Draft", "North star"] },
      },
    },
    reference: [readDeck("noted"), edit("noted", [{ element: "title", value: "North star", readAt: 1 }], 0)],
    wrong: {
      attempt: [readDeck("noted"), edit("noted", [{ element: "title", value: "North star", readAt: 0 }], 0)],
      reason: "tool",
    },
  },
]
