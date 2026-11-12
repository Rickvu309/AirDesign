import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pruneKeyed, readKeyed, writeKeyed } from "./keyed-cache.mjs"

const folder = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "keyed-cache-")), "nested")
process.on("exit", () => fs.rmSync(path.dirname(folder), { recursive: true, force: true }))
const isNumber = (value) => typeof value === "number"

assert.equal(readKeyed(folder, "a", isNumber), null)
writeKeyed(folder, "a", 1)
assert.equal(readKeyed(folder, "a", isNumber), 1)
assert.equal(
  readKeyed(folder, "a", (value) => value === 2),
  null,
)
fs.writeFileSync(path.join(folder, "b.json"), "{not json")
assert.equal(readKeyed(folder, "b", isNumber), null)
fs.writeFileSync(path.join(folder, "c.json"), JSON.stringify({ key: "other", value: 3 }))
assert.equal(readKeyed(folder, "c", isNumber), null)
assert.deepEqual(
  fs
    .readdirSync(folder)
    .filter((name) => name.includes(".json") && name !== "b.json" && name !== "c.json")
    .sort(),
  ["a.json"],
)

const old = new Date(Date.now() - 40 * 86_400_000)
writeKeyed(folder, "old", 1)
writeKeyed(folder, "used", 1)
fs.utimesSync(path.join(folder, "old.json"), old, old)
fs.utimesSync(path.join(folder, "used.json"), old, old)
assert.equal(readKeyed(folder, "used", isNumber), 1)
assert.equal(pruneKeyed(folder, { olderThanDays: 30 }), 1)
assert.deepEqual(fs.readdirSync(folder).sort(), ["a.json", "b.json", "c.json", "used.json"])
assert.equal(pruneKeyed(path.join(folder, "missing"), { olderThanDays: 30 }), 0)
