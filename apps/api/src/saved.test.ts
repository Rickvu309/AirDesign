import { readDeckId } from "@airdesign/catalog"
import { legacyElement, openRegister, readRegister, rootElement } from "@airdesign/document"
import { openDeck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"

import { wireCommit } from "./harness.js"

import type { Sql } from "./pool.js"
import { commitEdits, readSaved, watchedRevision } from "./saved.js"

const readSql =
  "select id, revision, register, import_index, owner, deleted is not null as deleted from deck.saved where id = $1"

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
      await commitEdits(
        db,
        wireCommit({ deck: "other", batch: [{ value: "hi", node: "258.7" }] }),
        "owner@example.com",
      ),
    ).toEqual({
      ok: false,
      refusal: "deck",
    })
    expect(statements).toEqual([readSql])
  })

  it("folds a register stored in the root shape into the element map when it reads the row", async () => {
    const first = openRegister("", "deck").elements[rootElement]
    if (first === undefined) throw new Error("missing node")
    const stored = {
      ...first,
      landed: [
        { actor: "person", value: "kept", visible: true },
        { actor: "agent", value: "hidden", visible: false, runId: "run" },
      ],
      phase: "undone",
      runId: "run",
      nodes: [rootElement],
      readNodes: null,
      elements: {},
      b: { ...first, floor: "legacy" },
    }
    const db = {
      async query() {
        return { rows: [{ id: "deck", revision: 4, register: stored, owner: "owner@example.com" }] }
      },
    } as unknown as Sql
    const saved = await readSaved(db, "deck")
    const folded = readRegister(stored)
    expect(folded.ok).toBe(true)
    expect(saved).toEqual({
      id: "deck",
      revision: 4,
      register: folded.ok ? folded.value : null,
      owner: "owner@example.com",
      deleted: false,
    })
    expect(saved?.register?.elements[rootElement]?.landed).toEqual(stored.landed)
    expect(saved?.register?.elements[legacyElement]?.floor).toBe("legacy")
    expect(Object.hasOwn(saved?.register ?? {}, "landed")).toBe(false)
  })

  it("keeps reporting the revisions of a deck this build cannot read, and still refuses another account first", () => {
    const unread = {
      id: "deck",
      revision: 3,
      owner: "owner@example.com",
      deleted: false,
      register: null,
      unread: "newer",
    } as const
    expect(watchedRevision(unread, "owner@example.com", 1)).toBe(2)
    expect(watchedRevision(unread, "owner@example.com", 3)).toBeUndefined()
    expect(watchedRevision(unread, "other@example.com", 1)).toBe("owner")
  })
})
