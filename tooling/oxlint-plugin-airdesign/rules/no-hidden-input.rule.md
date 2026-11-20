# Product code takes the clock, random ids and temp folders as options: no read of `Date.now`, `Date()`, `new Date()`, `performance.now`, `Temporal.Now`, `Math.random`, `crypto.randomUUID`, `crypto.getRandomValues`, `tmpdir` or `TMPDIR`, except as the `??` or default-parameter fallback of an option

lint: `no-hidden-input`. It warns for now and blocks nothing
