import { execFileSync } from 'node:child_process'
import { expect, test } from 'vitest'

test('release tool installation retries and bounds failures', () => {
  const output = execFileSync('bash', ['tests/release/install-tools.test.sh'], { encoding: 'utf8' })
  expect(output).toContain('recover: status=0 attempts=3 delays=5,10')
  expect(output).toContain('fail: status=1 attempts=3 delays=5,10')
  expect(output).toContain('hang: status=124 attempts=3 delays=5,10')
})
