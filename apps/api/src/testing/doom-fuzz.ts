const edit = {
  once: "fuzz-doom",
  author: { kind: "person", id: "fuzz" },
  writes: [{ node: "s:1", prop: "name", value: "Fuzz" }],
}

function landed(fields: Record<string, unknown>) {
  return [{ shape: "json" as const, answers: 200, says: '"ok":true', fields }]
}

export function doomFuzzGood(deck: string) {
  return {
    "POST /doom/create": landed({ deck }),
    "POST /doom/open": landed({ deck }),
    "POST /doom/edit": landed({ deck, edit }),
    "POST /doom/since": landed({ deck, rev: 0 }),
    "POST /doom/run": landed({ deck, run: "fuzz-run" }),
    "POST /doom/screenshots": landed({ deck, rev: 0, screenshots: { keys: [], images: [] } }),
  }
}
