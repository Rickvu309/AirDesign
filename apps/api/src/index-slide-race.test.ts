import { expect, it } from "vitest"
import { readDeckId } from "@airdesign/catalog"
import { call } from "@airdesign/engine"
import { postgresInfo } from "./harness.js"
import { openPool } from "./pool.js"
import { indexSaved } from "./index-saved.js"
import { openSaved, writeRevision } from "./saved.js"

it("does not write a slide command decided before a conflicting import index arrived", async () => {
  const info = await postgresInfo()
  const db = openPool(info.deck)
  const account = openPool(info.session)
  const parsed = readDeckId("index-slide-race")
  if (!parsed.ok) throw new Error("deck")
  const owner = "race@example.com"
  try {
    await account.query("insert into session.account (email) values ($1)", [owner])
    const opened = await openSaved(db, parsed, owner)
    if (!opened.ok) throw new Error(opened.refusal)
    const changed = call(
      "commit_edits",
      { id: parsed.deck, ...opened },
      { actor: "person" },
      {
        deck: parsed.deck,
        batch: [{ slide: "remove", id: "257", file: ["256", "257"] }],
      },
    )
    if (!changed.ok) throw new Error(changed.refusal)
    expect(
      await indexSaved(
        db,
        {
          ok: true,
          deck: parsed.deck,
          once: "index",
          offset: 0,
          total: 0,
          slides: [
            { id: "257", position: 0 },
            { id: "256", position: 1 },
          ],
          elements: [],
        },
        owner,
      ),
    ).toMatchObject({ ok: true })
    expect(
      await writeRevision(db, {
        id: parsed.deck,
        revision: changed.deck.revision,
        register: changed.deck.register,
        expected: opened.revision,
        key: changed.key,
      }),
    ).toBe(false)
  } finally {
    await Promise.all([db.end(), account.end()])
  }
})
