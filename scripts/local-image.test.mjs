import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fontListing, localImage } from "./local-image.mjs"

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "local-image-"))
process.on("exit", () => fs.rmSync(folder, { recursive: true, force: true }))
fs.mkdirSync(path.join(folder, "truetype"))
fs.writeFileSync(path.join(folder, "truetype", "a.ttf"), "font a")

const base = {
  env: { LANG: "C.UTF-8" },
  listing: fontListing([folder, path.join(folder, "missing")]),
  release: "ID=ubuntu",
}
assert.equal(base.listing.length, 1)
assert.match(base.listing[0], /truetype\/a\.ttf 6 /)
const image = localImage(base)
assert.equal(image.imageOs, "local")
assert.match(image.imageVersion, /^[0-9a-f]{64}$/)
assert.deepEqual(localImage(base), image)
assert.notEqual(localImage({ ...base, env: { LANG: "vi_VN.UTF-8" } }).imageVersion, image.imageVersion)
assert.notEqual(localImage({ ...base, release: "ID=debian" }).imageVersion, image.imageVersion)
assert.notEqual(
  localImage({ ...base, listing: [...base.listing, "/usr/share/fonts/b.ttf 1 1"] }).imageVersion,
  image.imageVersion,
)

fs.writeFileSync(path.join(folder, "truetype", "a.ttf"), "font a, longer")
assert.notEqual(localImage({ ...base, listing: fontListing([folder]) }).imageVersion, image.imageVersion)
