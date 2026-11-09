import { execFileSync } from 'node:child_process'
import { expect, test } from 'vitest'

test('release tool installation authenticates, verifies and bounds failures', () => {
  const output = execFileSync('bash', ['tests/release/install-tools.test.sh'], { encoding: 'utf8' })
  expect(output).toContain('success: status=0 downloads=1')
  expect(output).toContain('recover: status=0 downloads=3')
  expect(output).toContain('fail: status=17 downloads=3')
  expect(output).toContain('hang: status=124 downloads=3')
  expect(output).toContain('checksum: status=1 downloads=3')
  expect(output).toContain('wrong-version: status=1 downloads=3')
  expect(output).toContain('npm-fail: status=17 downloads=0')
  expect(output).toContain('unauthenticated: status=1 downloads=0')
})
