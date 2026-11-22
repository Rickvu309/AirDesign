import { describe, expect, it } from "vitest"

const sources = import.meta.glob<string>("./**/*.tsx", { query: "?raw", import: "default", eager: true })

const realFiles = [
  "aira/aira-composer.tsx",
  "aira/aira-panel.tsx",
  "decks/decks-shell.tsx",
  "decks/delete-account.tsx",
  "settings/account-card.tsx",
  "settings/account-page.tsx",
  "settings/agents-page.tsx",
  "settings/settings-page.tsx",
  "settings/usage-page.tsx",
]

describe("the words a real page shows", () => {
  it.each(realFiles)("%s imports no sample file", (file) => {
    const source = sources[`./${file}`]
    expect(source, `${file} is read`).toBeTypeOf("string")
    expect(source?.match(/from "[^"]*-sample"/g) ?? []).toEqual([])
  })
})
