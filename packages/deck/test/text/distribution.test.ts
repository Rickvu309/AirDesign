import {execFileSync} from "node:child_process"
import {expect, it} from "vitest"

it("ships the shared text codec as a public dependency-free subpath", () => {
  execFileSync(process.execPath, ["scripts/build-deck.mjs"], {cwd: process.cwd(), stdio: "pipe"})
  const program = 'import assert from "node:assert/strict"; import {parseTextBody,parseNativeArchiveV3} from "@airdesign/deck/text"; assert.equal(typeof parseNativeArchiveV3,"function"); assert.throws(()=>parseTextBody({}),/invalid-text-body/); process.stdout.write("shared-text-codec-pass")'
  const result = execFileSync(process.execPath, ["--input-type=module", "-e", program], {cwd: process.cwd(), encoding: "utf8"})
  expect(result).toBe("shared-text-codec-pass")
})
