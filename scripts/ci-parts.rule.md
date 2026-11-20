# Tests never retry

Vitest and Playwright set no retries; lint `no-blind-wait` refuses `retries` and a per-test timeout in a browser test; ci fails a rerun; a fresh run is attempt 1 (`ci-parts.test.mjs`)
