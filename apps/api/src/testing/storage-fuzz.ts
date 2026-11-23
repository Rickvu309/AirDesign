import { fontRevision, fontRoutes } from "@airdesign/fonts"

const sha256 = "a".repeat(64)

function storage(fields: Record<string, unknown>) {
  return [{ shape: "json" as const, answers: 200, says: '"refusal":"storage"', fields }]
}

export function storageFuzzGood(deck: string) {
  return {
    [`GET ${fontRoutes.family.path}`]: [{ shape: "query" as const, answers: 404, fields: { family: "UnknownFont" } }],
    [`GET ${fontRoutes.file.path}`]: [
      {
        shape: "query" as const,
        answers: 404,
        fields: { family: "UnknownFont", file: "unknown.ttf", v: fontRevision },
      },
    ],
    "POST /decks/media/upload": storage({ deck, bytes: 4, sha256 }),
    "POST /decks/media": storage({ deck, sha256 }),
  }
}
