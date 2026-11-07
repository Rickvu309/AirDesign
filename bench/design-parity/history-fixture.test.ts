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
