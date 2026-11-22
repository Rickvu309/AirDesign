const edit = {
  once: "fuzz-scene",
  author: { kind: "person", id: "fuzz" },
  writes: [{ node: "s:1", prop: "name", value: "Fuzz" }],
}

function landed(fields: Record<string, unknown>) {
  return [{ shape: "json" as const, answers: 200, says: '"ok":true', fields }]
}

export function sceneFuzzGood(deck: string) {
  return {
    "POST /scenes/create": landed({ deck }),
    "POST /scenes/open": landed({ deck }),
    "POST /scenes/edit": landed({ deck, edit }),
    "POST /scenes/since": landed({ deck, rev: 0 }),
    "POST /scenes/run": landed({ deck, run: "fuzz-run" }),
    "POST /scenes/pictures": landed({ deck, rev: 0, pictures: { keys: [], images: [] } }),
  }
}
