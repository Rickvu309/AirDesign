import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { namedLists, shareOut, validationKey, validatorCode, validatorLine, validatorLists } from "./pptx-validator.mjs"

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-validator-"))
process.on("exit", () => fs.rmSync(folder, { recursive: true, force: true }))
const decks = path.join(folder, "decks")
fs.mkdirSync(decks)
const write = (name, text, dir = decks) => {
  const file = path.join(dir, name)
  fs.writeFileSync(file, text)
  return file
}
const cache = path.join(folder, "cache")

const validated = []
const fakeJudge = async (files) => {
  validated.push(files.map((file) => path.basename(file)))
  return files.map((file) => {
    const text = fs.readFileSync(file, "utf8")
    return {
      file: path.basename(file),
      opened: text.startsWith("broken") ? "Exception: broken" : "ok",
      list: text.includes("warn") ? [`Error: ${text}`] : [],
    }
  })
}

const files = [
  write("a.pptx", "fine a"),
  write("b.pptx", "warn b"),
  write("c.pptx", "fine a"),
  write("d.pptx", "broken d"),
]
const tally = { files: 0, distinct: 0, hits: 0 }
const first = await validatorLists({ files, code: "one", folder: cache, width: 2, validate: fakeJudge, tally })
assert.deepEqual(
  [...first],
  [
    ["a.pptx", []],
    ["b.pptx", ["Error: warn b"]],
    ["c.pptx", []],
    ["d.pptx", ["open: Exception: broken"]],
  ],
)
assert.equal(validated.flat().length, 3)
assert.equal(validated.flat().includes("c.pptx"), false)
assert.equal(validated.length, 2)
assert.equal(validatorLine(tally), "validator 4 files, 3 different, 0 answered by the cache, 3 validated")

validated.length = 0
const again = { files: 0, distinct: 0, hits: 0 }
const second = await validatorLists({ files, code: "one", folder: cache, width: 2, validate: fakeJudge, tally: again })
assert.deepEqual([...second], [...first])
assert.equal(validated.length, 0)
assert.equal(validatorLine(again), "validator 4 files, 3 different, 3 answered by the cache, 0 validated")

await validatorLists({ files, code: "two", folder: cache, width: 2, validate: fakeJudge })
assert.equal(validated.flat().length, 3)

fs.writeFileSync(path.join(decks, "a.pptx"), "warn changed")
validated.length = 0
const changed = await validatorLists({ files, code: "two", folder: cache, width: 2, validate: fakeJudge })
assert.deepEqual(changed.get("a.pptx"), ["Error: warn changed"])
assert.deepEqual(validated.flat(), ["a.pptx"])

const elsewhere = path.join(folder, "elsewhere")
fs.mkdirSync(elsewhere)
await assert.rejects(
  validatorLists({
    files: [files[0], write("a.pptx", "another", elsewhere)],
    code: "two",
    folder: cache,
    validate: fakeJudge,
  }),
  /a\.pptx is two different files/,
)
await assert.rejects(
  validatorLists({
    files: [write("e.pptx", "fine e")],
    code: "two",
    folder: cache,
    validate: async () => [],
  }),
  /no answer for e\.pptx/,
)

const groups = shareOut({
  items: [
    { name: "big", size: 10 },
    { name: "mid", size: 6 },
    { name: "small", size: 4 },
    { name: "tiny", size: 1 },
  ],
  width: 2,
})
assert.deepEqual(
  groups.map((group) => group.map((item) => item.name)),
  [
    ["big", "tiny"],
    ["mid", "small"],
  ],
)
assert.deepEqual(shareOut({ items: [], width: 3 }), [])
assert.equal(shareOut({ items: [{ name: "x", size: 1 }], width: 4 }).length, 1)

assert.notEqual(
  validationKey({ bytes: Buffer.from("x"), code: "a" }),
  validationKey({ bytes: Buffer.from("x"), code: "b" }),
)
assert.notEqual(
  validationKey({ bytes: Buffer.from("x"), code: "a" }),
  validationKey({ bytes: Buffer.from("y"), code: "a" }),
)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
assert.match(validatorCode(root), /^[0-9a-f]{64}$/)

const byFile = new Map([
  ["a.pptx", ["Error: a"]],
  ["neutral.pptx", []],
])
const named = namedLists(byFile, ["a.pptx", "../../scripts/deck-templates/files/neutral.pptx"])
assert.deepEqual(named.get("a.pptx"), ["Error: a"])
assert.deepEqual(named.get("../../scripts/deck-templates/files/neutral.pptx"), [])
assert.deepEqual(named.get("neutral.pptx"), [])
