# A test that reaches `dumpSpec` runs it in a hook or test with its own timeout sized for TLC

`spec-timeouts` step (`scripts/spec-timeouts.mjs`, tested by `scripts/spec-timeouts.test.mjs`) traces `dumpSpec` directly and through imported or local helpers such as `specGraph` and `dumpTopics`, and fails any Vitest `it`, `test`, `beforeAll`, `beforeEach`, `afterAll`, `afterEach` or top-level test code that reaches `dumpSpec` without an explicit timeout above Vitest's default (5 s for tests, 10 s for hooks)
