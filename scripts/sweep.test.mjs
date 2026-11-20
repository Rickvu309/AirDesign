import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { listedRecently, listingMinutes } from "./sweep.mjs"

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sweep-test-"))
try {
  const stamp = path.join(folder, "nested", "sweep-listed")
  const now = Date.now()
  assert.equal(listedRecently({ stamp, now, minutes: 30 }), false, "a machine never listed has nothing recent")
  fs.mkdirSync(path.dirname(stamp))
  fs.writeFileSync(stamp, "")
  assert.equal(listedRecently({ stamp, now: Date.now(), minutes: 30 }), true, "a list just made is recent")
  const old = new Date(now - 31 * 60_000)
  fs.utimesSync(stamp, old, old)
  assert.equal(listedRecently({ stamp, now, minutes: 30 }), false, "a list older than the gap is due again")
  assert.equal(listedRecently({ stamp, now, minutes: 45 }), true, "and still recent inside a longer gap")
  assert.equal(listingMinutes(["--at-most-every=30"]), 30)
  assert.equal(listingMinutes(["--apply"]), undefined)
  assert.equal(listingMinutes([]), undefined)
  assert.throws(() => listingMinutes(["--at-most-every=soon"]), /minutes/)
} finally {
  fs.rmSync(folder, { recursive: true, force: true })
}
