import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"

type ConversionAttempt = {status: number | null; stdout: string; stderr: string; error?: Error}

export function convertWithFreshProfile(binary: string, args: string[], execute: () => ConversionAttempt = () => spawnSync(binary, args, {encoding: "utf8", timeout: 120000})) {
  const attempts = [execute()]
  if (attempts[0]!.status === 81) attempts.push(execute())
  const final = attempts.at(-1)!
  assert.equal(final.status, 0, final.error?.message ?? final.stderr)
  return {attempts, stdout: final.stdout}
}
