function landed(fields: Record<string, unknown>) {
  return [{ shape: "json" as const, answers: 200, says: '"ok":true', fields }]
}

export function deckListFuzzGood(deck: string) {
  return {
    "POST /decks/list": landed({}),
    "POST /decks/rename": landed({ deck, name: "n" }),
    "POST /decks/star": landed({ deck, starred: true }),
    "POST /decks/trash": landed({ deck }),
    "POST /decks/restore": landed({ deck }),
    "POST /decks/delete": landed({ decks: ["fuzzmissing"] }),
  }
}
