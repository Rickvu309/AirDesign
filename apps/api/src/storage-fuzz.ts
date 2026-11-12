const sha256 = "a".repeat(64)

function storage(fields: Record<string, unknown>) {
  return [{ shape: "json" as const, answers: 200, says: '"refusal":"storage"', fields }]
}

export function storageFuzzGood(deck: string) {
  return {
    "POST /decks/original/upload": storage({ deck, bytes: 4, sha256 }),
    "POST /decks/original/done": storage({ deck }),
    "POST /decks/original": storage({ deck }),
    "POST /decks/media/upload": storage({ deck, bytes: 4, sha256 }),
    "POST /decks/media": storage({ deck, sha256 }),
  }
}
