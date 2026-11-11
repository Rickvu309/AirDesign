import { readElementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import {
  catalog,
  notifyKey,
  parseNotifyKey,
  projectTools,
  readAgentEdit,
  readApprovalRequest,
  readBearer,
  readCapture,
  readClientMetadata,
  readClientRequest,
  readCode,
  readCommit,
  readDecks,
  readEdit,
  readEmail,
  readHost,
  readLinkToken,
  readNamedDeck,
  readNoFields,
  readRename,
  readRevokeRequest,
  readRun,
  readRunStart,
  readSessionCookie,
  readTokenRequest,
  readWatch,
  storableText,
} from "./index.js"

describe("readEdit", () => {
  it("refuses an actor", () => {
    expect(readEdit({ value: "hi", node: "258.7", actor: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a command", () => {
    expect(readEdit({ value: "hi", node: "258.7", command: "agent" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a principal", () => {
    expect(readEdit({ value: "hi", node: "258.7", principal: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a person", () => {
    expect(readEdit({ value: "hi", node: "258.7", person: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses an agent", () => {
    expect(readEdit({ value: "hi", node: "258.7", agent: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a surface", () => {
    expect(readEdit({ value: "hi", node: "258.7", surface: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses an onBehalfOf", () => {
    expect(readEdit({ value: "hi", node: "258.7", onBehalfOf: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a node outside the named pair", () => {
    expect(readEdit({ value: "hi", node: "c" })).toEqual({ ok: false, refusal: "field" })
    expect(readEdit({ value: "hi", node: "a" })).toEqual({ ok: false, refusal: "field" })
    expect(readEdit({ value: "hi", node: "b" })).toEqual({ ok: false, refusal: "field" })
    expect(readEdit({ value: "hi" })).toEqual({ ok: false, refusal: "field" })
    expect(readEdit({ value: "hi", node: "258." })).toEqual({ ok: false, refusal: "field" })
  })

  it("reads a node id and refuses anything else", () => {
    expect(readElementId("258.7")).toBe("258.7")
    expect(readElementId("n4k2j9x0q1zab.7")).toBe("n4k2j9x0q1zab.7")
    expect(readElementId("n4k2j9x0q1zab.n4k2j9x0q1zab")).toBe("n4k2j9x0q1zab.n4k2j9x0q1zab")
    expect(readElementId("0.0000000000")).toBe("0.0000000000")
    expect(readElementId("a")).toBeUndefined()
    expect(readElementId("258.")).toBeUndefined()
    expect(readElementId("12345678901.7")).toBeUndefined()
    expect(readElementId("258.12345678901")).toBeUndefined()
    expect(readElementId(7)).toBeUndefined()
    expect(readElementId(undefined)).toBeUndefined()
  })

  it("keeps a named node", () => {
    expect(readEdit({ value: "hi", node: "258.7" })).toEqual({ ok: true, edit: { value: "hi", node: "258.7" } })
    expect(readEdit({ value: "hi", node: "258.n4k2j9x0q1zab", floor: "old" })).toEqual({
      ok: true,
      edit: { value: "hi", node: "258.n4k2j9x0q1zab", floor: "old" },
    })
  })

  it("refuses a readAt on a person edit", () => {
    expect(readEdit({ value: "hi", node: "258.7", readAt: 0 })).toEqual({ ok: false, refusal: "field" })
    expect(readCommit({ deck: "deck", batch: [{ value: "hi", node: "258.7", readAt: 0 }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses malformed element ids on person and agent edits", () => {
    for (const node of [".7", "12345678901.7", "258.12345678901", "258.n123456789ab", "258.nA23456789abc", "258.7\n"]) {
      expect(readEdit({ value: "x", node })).toEqual({ ok: false, refusal: "field" })
      expect(readAgentEdit({ deck: "deck", base: 0, changes: [{ value: "x", node, readAt: 0 }] })).toEqual({
        ok: false,
        refusal: "field",
      })
    }
  })

  it("refuses a floor that is not a string", () => {
    expect(readEdit({ value: "x", node: "258.7", floor: 7 })).toEqual({ ok: false, refusal: "field" })
    expect(
      readAgentEdit({ deck: "deck", base: 0, changes: [{ value: "x", node: "258.7", readAt: 0, floor: 7 }] }),
    ).toEqual({ ok: false, refusal: "field" })
  })
})

describe("readCommit", () => {
  it("reads a batch of edits", () => {
    expect(
      readCommit({
        deck: "deck",
        batch: [
          { value: "hi", node: "258.7" },
          { value: "ho", node: "258.8", floor: "ho" },
        ],
      }),
    ).toEqual({
      ok: true,
      deck: "deck",
      batch: [
        { value: "hi", node: "258.7" },
        { value: "ho", node: "258.8", floor: "ho" },
      ],
    })
  })

  it("keeps an element id read from a file", () => {
    expect(readCommit({ deck: "deck", batch: [{ value: "kept", node: "382.5", floor: "file text" }] })).toEqual({
      ok: true,
      deck: "deck",
      batch: [{ value: "kept", node: "382.5", floor: "file text" }],
    })
  })

  it("refuses an actor beside the batch", () => {
    expect(readCommit({ deck: "deck", actor: "agent", batch: [{ value: "hi", node: "258.7" }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses an empty batch", () => {
    expect(readCommit({ deck: "deck", batch: [] })).toEqual({ ok: false, refusal: "batch" })
  })

  it("reads a batch of 100", () => {
    const batch = Array.from({ length: 100 }, () => ({ value: "hi", node: "258.7" }))
    expect(readCommit({ deck: "deck", batch })).toEqual({ ok: true, deck: "deck", batch })
  })

  it("refuses a batch longer than 100", () => {
    expect(
      readCommit({ deck: "deck", batch: Array.from({ length: 101 }, () => ({ value: "hi", node: "258.7" })) }),
    ).toEqual({
      ok: false,
      refusal: "batch",
    })
  })

  it("refuses a once that is not 1 to 64 safe characters", () => {
    const batch = [{ value: "hi", node: "258.7" }]
    const fit = "a".repeat(64)
    expect(readCommit({ deck: "deck", batch, once: "a".repeat(65) })).toEqual({ ok: false, refusal: "field" })
    expect(readCommit({ deck: "deck", batch, once: "" })).toEqual({ ok: false, refusal: "field" })
    expect(readCommit({ deck: "deck", batch, once: 1 })).toEqual({ ok: false, refusal: "field" })
    expect(readCommit({ deck: "deck", batch, once: "bad once" })).toEqual({ ok: false, refusal: "field" })
    expect(readCommit({ deck: "deck", batch, once: fit })).toEqual({ ok: true, deck: "deck", batch, once: fit })
  })
})

describe("readWatch", () => {
  it("reads a null cursor", () => {
    expect(readWatch({ deck: "deck", cursor: null })).toEqual({ ok: true, deck: "deck", cursor: null })
  })

  it("reads a zero cursor", () => {
    expect(readWatch({ deck: "deck", cursor: 0 })).toEqual({ ok: true, deck: "deck", cursor: 0 })
  })

  it("refuses a missing cursor", () => {
    const watched = readWatch({ deck: "deck" })
    expect(watched.ok).toBe(false)
    if (watched.ok) return
    expect(watched.refusal === "field" || watched.refusal === "cursor").toBe(true)
  })
})

describe("readAgentEdit", () => {
  it("reads a base and its changes", () => {
    expect(readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", node: "258.7", readAt: 0 }] })).toEqual({
      ok: true,
      deck: "deck",
      base: 4,
      changes: [{ value: "hi", node: "258.7", readAt: 0 }],
    })
    expect(
      readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", node: "258.7", readAt: 0, floor: "kept" }] }),
    ).toEqual({
      ok: true,
      deck: "deck",
      base: 4,
      changes: [{ value: "hi", node: "258.7", readAt: 0, floor: "kept" }],
    })
  })

  it("refuses an actor inside a change", () => {
    expect(
      readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", node: "258.7", readAt: 0, actor: "agent" }] }),
    ).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses an agent change without a whole readAt", () => {
    expect(readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", node: "258.7" }] })).toEqual({
      ok: false,
      refusal: "field",
    })
    expect(readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", node: "258.7", readAt: 1.5 }] })).toEqual({
      ok: false,
      refusal: "field",
    })
    expect(readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", node: "258.7", readAt: -1 }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses an agent change without a node", () => {
    expect(readAgentEdit({ deck: "deck", base: 0, changes: [{ value: "x", readAt: 0 }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses a string readAt", () => {
    expect(readAgentEdit({ deck: "deck", base: 0, changes: [{ value: "x", node: "258.7", readAt: "0" }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses an unknown key on an agent change", () => {
    expect(
      readAgentEdit({ deck: "deck", base: 0, changes: [{ value: "x", node: "258.7", readAt: 0, extra: true }] }),
    ).toEqual({ ok: false, refusal: "field" })
  })

  it("requires a whole number base on an agent edit", () => {
    expect(readAgentEdit({ deck: "deck", changes: [{ value: "x", node: "258.7", readAt: 0 }] })).toEqual({
      ok: false,
      refusal: "base",
    })
    expect(readAgentEdit({ deck: "deck", base: "0", changes: [{ value: "x", node: "258.7", readAt: 0 }] })).toEqual({
      ok: false,
      refusal: "base",
    })
  })
})

describe("readCapture", () => {
  it("refuses a slide beside the deck", () => {
    expect(readCapture({ deck: "deck", slide: "a" })).toEqual({ ok: false, refusal: "field" })
  })

  it("reads the deck", () => {
    expect(readCapture({ deck: "deck" })).toEqual({ ok: true, deck: "deck" })
  })
})

describe("notifyKey", () => {
  it("joins the deck and the revision", () => {
    expect(notifyKey("deck", 3)).toEqual({ ok: true, key: "deck:3" })
  })

  it("refuses a key of 8000 bytes or more", () => {
    expect(notifyKey("a".repeat(8000), 0)).toEqual({ ok: false, refusal: "payload" })
  })

  it("refuses a fractional revision", () => {
    expect(notifyKey("deck", 1.5)).toEqual({ ok: false, refusal: "payload" })
  })
})

describe("parseNotifyKey", () => {
  it("reads a deck and a revision", () => {
    expect(parseNotifyKey("deck:3")).toEqual({ ok: true, deck: "deck", revision: 3 })
  })

  it("refuses a leading zero", () => {
    expect(parseNotifyKey("deck:03")).toEqual({ ok: false, refusal: "payload" })
  })

  it("refuses a fractional revision", () => {
    expect(parseNotifyKey("deck:1.5")).toEqual({ ok: false, refusal: "payload" })
  })
})

describe("readRunStart", () => {
  const elements = [{ node: "258.7" }]

  it("reads a run and its elements", () => {
    expect(
      readRunStart({ deck: "deck", runId: "run", elements: [{ node: "258.7" }, { node: "258.8", floor: "" }] }),
    ).toEqual({ ok: true, deck: "deck", runId: "run", elements: [{ node: "258.7" }, { node: "258.8", floor: "" }] })
  })

  it("refuses anything that is not an object", () => {
    for (const raw of [null, 7, "run", [], undefined]) {
      expect(readRunStart(raw)).toEqual({ ok: false, refusal: "field" })
    }
  })

  it("refuses an actor beside the elements", () => {
    expect(readRunStart({ deck: "deck", runId: "run", elements, actor: "person" })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses a missing deck as a field", () => {
    expect(readRunStart({ runId: "run", elements })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a malformed deck", () => {
    expect(readRunStart({ deck: "bad deck", runId: "run", elements })).toEqual({ ok: false, refusal: "deck" })
  })

  it("refuses a run id that is not 1 to 64 safe characters", () => {
    for (const runId of [undefined, 7, "", "a".repeat(65), "bad run"]) {
      expect(readRunStart({ deck: "deck", runId, elements })).toEqual({ ok: false, refusal: "field" })
    }
    const fit = "a".repeat(64)
    expect(readRunStart({ deck: "deck", runId: fit, elements })).toEqual({
      ok: true,
      deck: "deck",
      runId: fit,
      elements,
    })
  })

  it("refuses a missing run id", () => {
    expect(readRunStart({ deck: "deck", elements })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses missing, empty or non-list elements as a batch", () => {
    expect(readRunStart({ deck: "deck", runId: "run" })).toEqual({ ok: false, refusal: "batch" })
    expect(readRunStart({ deck: "deck", runId: "run", elements: [] })).toEqual({ ok: false, refusal: "batch" })
    expect(readRunStart({ deck: "deck", runId: "run", elements: { node: "258.7" } })).toEqual({
      ok: false,
      refusal: "batch",
    })
  })

  it("reads 100 elements and refuses 101", () => {
    const fit = Array.from({ length: 100 }, () => ({ node: "258.7" }))
    expect(readRunStart({ deck: "deck", runId: "run", elements: fit })).toEqual({
      ok: true,
      deck: "deck",
      runId: "run",
      elements: fit,
    })
    expect(readRunStart({ deck: "deck", runId: "run", elements: [...fit, { node: "258.7" }] })).toEqual({
      ok: false,
      refusal: "batch",
    })
  })

  it("refuses an element that is not an object", () => {
    expect(readRunStart({ deck: "deck", runId: "run", elements: ["258.7"] })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a value or an actor on an element", () => {
    for (const element of [
      { node: "258.7", value: "hi" },
      { node: "258.7", actor: "person" },
    ]) {
      expect(readRunStart({ deck: "deck", runId: "run", elements: [element] })).toEqual({
        ok: false,
        refusal: "field",
      })
    }
  })

  it("refuses a malformed element id", () => {
    for (const node of ["a", "b", "258.", 7, undefined]) {
      expect(readRunStart({ deck: "deck", runId: "run", elements: [{ node }] })).toEqual({
        ok: false,
        refusal: "field",
      })
    }
  })

  it("refuses a floor that is not a string", () => {
    expect(readRunStart({ deck: "deck", runId: "run", elements: [{ node: "258.7", floor: 7 }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })
})

describe("readRun", () => {
  it("reads a deck and a run id", () => {
    expect(readRun({ deck: "deck", runId: "run" })).toEqual({ ok: true, deck: "deck", runId: "run" })
  })

  it("refuses anything that is not an object", () => {
    for (const raw of [null, 7, "run", [], undefined]) {
      expect(readRun(raw)).toEqual({ ok: false, refusal: "field" })
    }
  })

  it("refuses an actor or elements beside the run", () => {
    expect(readRun({ deck: "deck", runId: "run", actor: "person" })).toEqual({ ok: false, refusal: "field" })
    expect(readRun({ deck: "deck", runId: "run", elements: [] })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a missing deck as a field", () => {
    expect(readRun({ runId: "run" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a malformed deck", () => {
    expect(readRun({ deck: "bad deck", runId: "run" })).toEqual({ ok: false, refusal: "deck" })
  })

  it("refuses a run id that is missing or not 1 to 64 safe characters", () => {
    expect(readRun({ deck: "deck" })).toEqual({ ok: false, refusal: "field" })
    for (const runId of [7, "", "a".repeat(65), "bad run"]) {
      expect(readRun({ deck: "deck", runId })).toEqual({ ok: false, refusal: "field" })
    }
  })
})

describe("run operations in the catalog", () => {
  it("keeps start_run and undo_run from agents and offers stop_run on the server", () => {
    expect(catalog.start_run).toEqual({ kind: "command", exposure: "web" })
    expect(catalog.stop_run).toMatchObject({ kind: "command", exposure: "agent", runsOn: "server" })
    expect(catalog.undo_run).toEqual({ kind: "command", exposure: "web" })
    expect(projectTools(catalog).map((tool) => tool.op)).toEqual(["capture_slide", "edit_deck", "stop_run"])
  })
})

describe("projectTools", () => {
  it("projects the three agent tools in name order", () => {
    const tools = projectTools(catalog)
    expect(tools).toHaveLength(3)
    expect(tools.map((tool) => tool.name)).toEqual([
      "airdesign_capture_slide",
      "airdesign_edit_deck",
      "airdesign_stop_run",
    ])
    expect(tools.map((tool) => tool.runsOn)).toEqual(["device", "server", "server"])
    expect(tools.find((tool) => tool.op === "stop_run")?.destructiveHint).toBe(false)
    expect(tools.find((tool) => tool.op === "stop_run")?.description).toContain("when your turn is finished")
    expect(tools.find((tool) => tool.op === "stop_run")?.description).toContain("closing elements")
    expect(tools.every((tool) => tool.openWorldHint === false)).toBe(true)
    const edit = tools.find((tool) => tool.name === "airdesign_edit_deck")
    const capture = tools.find((tool) => tool.name === "airdesign_capture_slide")
    expect(edit).toEqual({
      name: "airdesign_edit_deck",
      op: "edit_deck",
      description:
        "Write values on one deck. The server names the actor. Each answer carries the runId of your turn. Call airdesign_stop_run with it when your turn is finished.",
      runsOn: "server",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    })
    expect(capture).toEqual({
      name: "airdesign_capture_slide",
      op: "capture_slide",
      description: "Render one slide in the person's open tab.",
      runsOn: "device",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    })
  })

  it("omits a web row", () => {
    expect(
      projectTools({ commit_edits: { kind: "command", exposure: "web", runsOn: "server", description: "x" } }),
    ).toEqual([])
  })

  it("throws when an agent row omits where it runs", () => {
    expect(() => projectTools({ bad: { kind: "command", exposure: "agent", description: "x" } as never })).toThrow(
      "agent tool bad must say where it runs",
    )
  })
})

const unstorable = ["\u0000", "a\u0000b", "\ud800", "a\ud800b", "\udc00", "a\udc00b", "\udc00\ud800"]
const field = { ok: false, refusal: "field" }
const formType = "application/x-www-form-urlencoded"

describe("storableText", () => {
  it("accepts text with paired surrogates", () => {
    expect(storableText("plain \ud83d\ude00 text")).toBe(true)
    expect(storableText("")).toBe(true)
  })

  for (const text of unstorable) {
    it(`refuses ${JSON.stringify(text)}`, () => {
      expect(storableText(text)).toBe(false)
    })
  }

  for (const value of [undefined, null, 1, true, [], {}]) {
    it(`refuses the non-text ${JSON.stringify(value) ?? "undefined"}`, () => {
      expect(storableText(value)).toBe(false)
    })
  }
})

describe("every reader of text that reaches Postgres refuses what Postgres cannot store", () => {
  const redirect = "https://client.example/cb"
  const challenge = "a".repeat(43)
  const approval = {
    client_id: "c",
    redirect_uri: redirect,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }
  const readers: readonly (readonly [string, (text: string) => unknown])[] = [
    ["an edit value", (text) => readEdit({ value: text, node: "258.7" })],
    ["an edit floor", (text) => readEdit({ value: "v", node: "258.7", floor: text })],
    ["a commit value", (text) => readCommit({ deck: "d", batch: [{ value: text, node: "258.7" }] })],
    ["a commit floor", (text) => readCommit({ deck: "d", batch: [{ value: "v", node: "258.7", floor: text }] })],
    [
      "an agent change value",
      (text) => readAgentEdit({ deck: "d", base: 0, changes: [{ value: text, node: "258.7", readAt: 0 }] }),
    ],
    [
      "an agent change floor",
      (text) => readAgentEdit({ deck: "d", base: 0, changes: [{ value: "v", node: "258.7", readAt: 0, floor: text }] }),
    ],
    ["a run floor", (text) => readRunStart({ deck: "d", runId: "r", elements: [{ node: "258.7", floor: text }] })],
    ["a deck name", (text) => readRename({ deck: "d", name: text })],
    ["an email", (text) => readEmail({ email: `a${text}@example.com` })],
    ["a client name", (text) => readClientMetadata({ redirect_uris: [redirect], client_name: text })],
    ["a redirect address", (text) => readClientMetadata({ redirect_uris: [`${redirect}${text}`] })],
    ["a client id", (text) => readClientRequest({ client_id: text, redirect_uri: redirect })],
    ["a requested redirect", (text) => readClientRequest({ client_id: "c", redirect_uri: text })],
    ["a requested resource", (text) => readClientRequest({ client_id: "c", redirect_uri: redirect, resource: text })],
    ["an approval state", (text) => readApprovalRequest({ ...approval, state: text })],
  ]

  for (const [name, read] of readers) {
    for (const text of unstorable) {
      it(`${name} with ${JSON.stringify(text)}`, () => {
        expect(read(text)).toEqual(field)
      })
    }
  }

  for (const text of unstorable) {
    it(`a form field or name with ${JSON.stringify(text)}`, () => {
      const good: [string, string] = ["grant_type", "refresh_token"]
      expect(readTokenRequest(formType, [good, ["refresh_token", text], ["client_id", "c"]])).toEqual({
        ok: false,
        refusal: "invalid_request",
      })
      expect(readRevokeRequest(formType, [[text, "t"]])).toEqual({ ok: false, refusal: "invalid_request" })
    })

    it(`a link token with ${JSON.stringify(text)}`, () => {
      expect(readLinkToken(text)).toBeUndefined()
    })
  }
})

describe("readSessionCookie", () => {
  const name = "airdesign.session"

  it("reads the session among other cookies", () => {
    expect(readSessionCookie(`a=1; ${name}=to%20ken; b=2`)).toBe("to ken")
  })

  it("uses the first session cookie", () => {
    expect(readSessionCookie(`${name}=first; ${name}=second`)).toBe("first")
  })

  for (const header of [
    undefined,
    7,
    ["x"],
    "",
    "other=1",
    `${name}=`,
    `${name}=%`,
    `${name}=%E0%A4%A`,
    `${name}=%ED%A0%80`,
    `${name}=%00`,
    `${name}=a%00b`,
    `${name}=a\u0000b`,
    `${name}=%E0%A4%A; ${name}=good`,
  ]) {
    it(`refuses ${JSON.stringify(header) ?? "undefined"}`, () => {
      expect(readSessionCookie(header)).toBeUndefined()
    })
  }
})

describe("readBearer", () => {
  it("reads a bearer in any case of the scheme", () => {
    expect(readBearer("Bearer abc.DEF_~+/=-")).toBe("abc.DEF_~+/=-")
    expect(readBearer("bearer abc")).toBe("abc")
  })

  for (const header of [
    undefined,
    1,
    ["Bearer a"],
    "",
    "Bearer",
    "Bearer ",
    "Basic abc",
    "Bearer a b",
    "Bearer a\u0000",
  ]) {
    it(`refuses ${JSON.stringify(header) ?? "undefined"}`, () => {
      expect(readBearer(header)).toBeUndefined()
    })
  }
})

describe("readHost", () => {
  for (const host of ["localhost", "127.0.0.1", "127.0.0.1:8080", "app.example", "[::1]", "[::1]:80", "a:65535"]) {
    it(`reads ${host}`, () => {
      expect(readHost(host)).toBe(host)
    })
  }

  for (const host of [
    undefined,
    7,
    ["localhost"],
    "",
    " ",
    "user@127.0.0.1",
    "user:pass@127.0.0.1",
    "a@b@127.0.0.1",
    "user:pass@localhost:80",
    "127.0.0.1:",
    "127.0.0.1:port",
    "127.0.0.1:65536",
    "127.0.0.1:123456",
    "a b",
    "a\u0000b",
    "caf\u00e9.example",
    "a/b",
    "a?b",
    "a#b",
    "[::1",
    "::1",
  ]) {
    it(`refuses ${JSON.stringify(host) ?? "undefined"}`, () => {
      expect(readHost(host)).toBeUndefined()
    })
  }
})

describe("readLinkToken", () => {
  it("reads a token", () => {
    expect(readLinkToken("abc")).toBe("abc")
  })

  for (const raw of [null, undefined, "", 1]) {
    it(`refuses ${JSON.stringify(raw) ?? "undefined"}`, () => {
      expect(readLinkToken(raw)).toBeUndefined()
    })
  }
})

const wrongBodies = [undefined, null, true, 0, "text", []]

describe("readEmail and readCode", () => {
  it("reads and folds an address", () => {
    expect(readEmail({ email: " A@Example.COM " })).toEqual({ ok: true, email: "a@example.com" })
  })

  it("reads a code", () => {
    expect(readCode({ email: "a@example.com", code: "012345" })).toEqual({
      ok: true,
      email: "a@example.com",
      code: "012345",
    })
  })

  for (const body of [
    ...wrongBodies,
    {},
    { email: 7 },
    { email: "" },
    { email: "no-at" },
    { email: "a@b.co", extra: 1 },
    { email: `${"a".repeat(250)}@b.co` },
  ]) {
    it(`readEmail refuses ${JSON.stringify(body)?.slice(0, 40) ?? "undefined"}`, () => {
      expect(readEmail(body)).toEqual(field)
    })
  }

  for (const body of [
    ...wrongBodies,
    { email: "a@b.co" },
    { email: "a@b.co", code: 123456 },
    { email: "a@b.co", code: "12345" },
    { email: "a@b.co", code: "1234567" },
    { email: "a@b.co", code: "123456", extra: 1 },
  ]) {
    it(`readCode refuses ${JSON.stringify(body) ?? "undefined"}`, () => {
      expect(readCode(body)).toEqual(field)
    })
  }
})

describe("deck list readers", () => {
  it("readNoFields takes only an empty object", () => {
    expect(readNoFields({})).toEqual({ ok: true })
    for (const body of [...wrongBodies, { a: 1 }]) expect(readNoFields(body)).toEqual(field)
  })

  it("readNamedDeck ignores other arguments and refuses a bad deck", () => {
    expect(readNamedDeck({ deck: "d", other: 1 })).toEqual({ ok: true, deck: "d" })
    expect(readNamedDeck({ deck: "a b" })).toEqual({ ok: false, refusal: "deck" })
    expect(readNamedDeck(JSON.parse('{"__proto__":{"deck":"d"}}'))).toEqual(field)
    for (const body of [...wrongBodies, {}]) expect(readNamedDeck(body)).toEqual(field)
  })

  it("readRename trims and bounds the name", () => {
    expect(readRename({ deck: "d", name: "  n  " })).toEqual({ ok: true, deck: "d", name: "n" })
    expect(readRename({ deck: "d", name: "\ud83d\ude00".repeat(200) })).toMatchObject({ ok: true })
    expect(readRename({ deck: "d", name: "x".repeat(201) })).toEqual(field)
    expect(readRename({ deck: "d", name: "   " })).toEqual(field)
    expect(readRename({ deck: "d", name: 7 })).toEqual(field)
    expect(readRename({ deck: "a b", name: "n" })).toEqual({ ok: false, refusal: "deck" })
    expect(readRename({ deck: "d", name: "n", extra: 1 })).toEqual(field)
  })

  it("readDecks bounds and folds the list", () => {
    expect(readDecks({ decks: ["a", "a", "b"] })).toEqual({ ok: true, decks: ["a", "b"] })
    expect(readDecks({ decks: Array.from({ length: 100 }, () => "a") })).toMatchObject({ ok: true })
    expect(readDecks({ decks: Array.from({ length: 101 }, () => "a") })).toEqual(field)
    expect(readDecks({ decks: [] })).toEqual(field)
    expect(readDecks({ decks: "a" })).toEqual(field)
    expect(readDecks({ decks: [7] })).toEqual({ ok: false, refusal: "deck" })
    expect(readDecks({ decks: ["a"], extra: 1 })).toEqual(field)
  })
})

describe("oauth readers", () => {
  const redirect = "https://client.example/cb"
  const approval = {
    client_id: "c",
    redirect_uri: redirect,
    code_challenge: "a".repeat(43),
    code_challenge_method: "S256",
  }

  it("readClientMetadata reads a client with and without a name", () => {
    expect(readClientMetadata({ redirect_uris: [redirect] })).toEqual({
      ok: true,
      redirectUris: [redirect],
      name: null,
    })
    expect(readClientMetadata({ redirect_uris: [redirect], client_name: "n" })).toMatchObject({ name: "n" })
  })

  for (const body of [
    ...wrongBodies,
    {},
    { redirect_uris: "x" },
    { redirect_uris: [] },
    { redirect_uris: [7] },
    { redirect_uris: ["https://a.example/#x"] },
    { redirect_uris: [`https://a.example/${"x".repeat(2000)}`] },
    { redirect_uris: Array.from({ length: 6 }, () => redirect) },
    { redirect_uris: [redirect], client_name: 7 },
    { redirect_uris: [redirect], client_name: "x".repeat(201) },
  ]) {
    it(`readClientMetadata refuses ${JSON.stringify(body)?.slice(0, 60) ?? "undefined"}`, () => {
      expect(readClientMetadata(body)).toEqual(field)
    })
  }

  it("readClientRequest reads the fields and refuses a resource that is not text", () => {
    expect(readClientRequest({ client_id: "c", redirect_uri: redirect, resource: "r" })).toEqual({
      ok: true,
      clientId: "c",
      redirectUri: redirect,
      resource: "r",
    })
    expect(readClientRequest({ client_id: "c", redirect_uri: redirect, resource: 7 })).toEqual({
      ok: false,
      refusal: "resource",
    })
    for (const body of [...wrongBodies, {}, { client_id: 7, redirect_uri: redirect }]) {
      expect(readClientRequest(body)).toEqual(field)
    }
  })

  it("readApprovalRequest reads the challenge and the state", () => {
    expect(readApprovalRequest({ ...approval, state: "s" })).toMatchObject({
      ok: true,
      challenge: approval.code_challenge,
      state: "s",
    })
    expect(readApprovalRequest(approval)).toMatchObject({ ok: true, state: undefined })
  })

  for (const change of [
    { code_challenge_method: "plain" },
    { code_challenge: 7 },
    { code_challenge: "a".repeat(42) },
    { code_challenge: "a".repeat(44) },
    { code_challenge: `${"a".repeat(42)}!` },
  ]) {
    it(`readApprovalRequest refuses the challenge ${JSON.stringify(change).slice(0, 60)}`, () => {
      expect(readApprovalRequest({ ...approval, ...change })).toEqual({ ok: false, refusal: "challenge" })
    })
  }

  const code: readonly [string, string][] = [
    ["grant_type", "authorization_code"],
    ["code", "c"],
    ["code_verifier", "v"],
    ["client_id", "id"],
    ["redirect_uri", redirect],
  ]
  const refresh: readonly [string, string][] = [
    ["grant_type", "refresh_token"],
    ["refresh_token", "r"],
    ["client_id", "id"],
  ]
  const invalid = { ok: false, refusal: "invalid_request" }

  it("readTokenRequest reads both grants", () => {
    expect(readTokenRequest(formType, code)).toEqual({
      ok: true,
      grant: "authorization_code",
      code: "c",
      verifier: "v",
      clientId: "id",
      redirectUri: redirect,
      resource: undefined,
    })
    expect(readTokenRequest(`${formType}; charset=utf-8`, [...refresh, ["resource", "x"]])).toEqual({
      ok: true,
      grant: "refresh_token",
      secret: "r",
      clientId: "id",
      resource: "x",
    })
  })

  it("readTokenRequest refuses another grant and every missing field", () => {
    expect(readTokenRequest(formType, [["grant_type", "password"]])).toEqual({
      ok: false,
      refusal: "unsupported_grant_type",
    })
    expect(readTokenRequest(formType, [])).toEqual(invalid)
    for (const pairs of [code, refresh]) {
      for (const [name] of pairs) {
        expect(
          readTokenRequest(
            formType,
            pairs.filter(([key]) => key !== name),
          ),
        ).toEqual(invalid)
      }
    }
  })

  it("the form readers refuse a duplicate field and a wrong content type", () => {
    expect(readTokenRequest(formType, [...refresh, ["client_id", "other"]])).toEqual(invalid)
    expect(
      readRevokeRequest(formType, [
        ["token", "a"],
        ["token", "b"],
      ]),
    ).toEqual(invalid)
    for (const type of [undefined, 7, "", ";;;", "application/json"]) {
      expect(readTokenRequest(type, refresh)).toEqual(invalid)
      expect(readRevokeRequest(type, [["token", "a"]])).toEqual(invalid)
    }
  })

  it("readRevokeRequest reads the token, or no token", () => {
    expect(readRevokeRequest(formType, [["token", "a"]])).toEqual({ ok: true, token: "a" })
    expect(readRevokeRequest(formType, [])).toEqual({ ok: true, token: undefined })
  })
})
