import {readFile} from "node:fs/promises"
import {expect,it} from "vitest"
import {historyFixtureSafetyHits} from "../../scripts/lint/history-fixture-safety.ts"

it("rejects the original fixture identity mutation and runtime commits",async()=>{
  const file="/bench/design-parity/history.test.ts"
  expect(historyFixtureSafetyHits(file,'git("config","user.name","Design parity history fixture")')).toHaveLength(1)
  expect(historyFixtureSafetyHits(file,'git("config","user.email","design-parity-history@example.invalid")')).toHaveLength(1)
  expect(historyFixtureSafetyHits(file,'git("commit","--allow-empty","-m","Record budget")')).toHaveLength(1)
  const generator="/bench/design-parity/generate-history-fixtures.ts"
  expect(historyFixtureSafetyHits(generator,'git("config","user.name","Design parity history fixture")')).toHaveLength(1)
  expect(historyFixtureSafetyHits(generator,await readFile("bench/design-parity/generate-history-fixtures.ts","utf8"))).toEqual([])
  expect(historyFixtureSafetyHits(file,await readFile("bench/design-parity/history.test.ts","utf8"))).toEqual([])
})

it.each([
  'git("commit","--author","Forged <forged@example.invalid>","-m","fixture")',
  'git("commit","--no-verify","-m","fixture")',
  'git("commit","-n","-m","fixture")',
  'git("-c","user.name=fixture","commit","-m","fixture")',
  'git("commit","--config-env=core.hooksPath=HOOKS","-m","fixture")',
  'process.env.GIT_AUTHOR_NAME="forged";git("commit","-m","fixture")',
  'process.env["GIT_COMMITTER_EMAIL"]="forged@example.invalid"',
  'const env={GIT_CONFIG_COUNT:"1"}',
  'execFileSync("git",["config","user.name","fixture"])',
  'const run=(...args:string[])=>execFileSync("git",args)',
  'spawnSync("git",["commit","--no-verify"])',
  'childProcess.execFileSync("git",["config","user.name","fixture"])',
  'const run=execFileSync;run("git",["config","user.name","fixture"])',
  'const childProcess=require("node:child_process")',
  'import {execFileSync as run} from "node:child_process"',
  'git("commit",...options)'
])("rejects fixture author or hook bypass source: %s",source=>{
  expect(historyFixtureSafetyHits("/bench/design-parity/generate-history-fixtures.ts",source).length).toBeGreaterThan(0)
})
