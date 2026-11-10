import { readDeckId } from "@airdesign/catalog"
import { openDeck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"

import type { Sql } from "./pool.js"
import { commitEdits } from "./saved.js"

const readSql = "select id, revision, register, owner from deck.saved where id = $1"

describe("saved", () => {
  it("refuses a commit whose deck is not the row the server loaded", async () => {
    const named = readDeckId("deck")
    if (!named.ok) {
      throw new Error(named.refusal)
    }
    const opened = openDeck(named.deck)
    const statements: string[] = []
    const db = {
      async query(sql: string) {
        statements.push(sql)
        return {
          rows: [
            {
              id: named.deck,
              revision: opened.revision,
              register: opened.register,
              owner: "owner@example.com",
            },
          ],
        }
      },
    } as unknown as Sql
    expect(
      await commitEdits(db, { deck: "other", batch: [{ value: "hi", node: "258.7" }] }, "owner@example.com"),
    ).toEqual({
      ok: false,
      refusal: "deck",
    })
    expect(statements).toEqual([readSql])
  })
})
