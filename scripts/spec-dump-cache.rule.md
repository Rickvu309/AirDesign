# A replay computes a missing spec dump, and CI saves a new spec cache key after a successful model check

A replay uses the dump for its spec key or runs TLC itself. Each writer publishes its complete result by rename, so a replay can fill a cold or partial cache while another process runs the same model. A source job that skips the model check cannot save a partial restore under the new exact key. `scripts/check-steps.test.mjs`, `scripts/check-specs.test.mjs` and `scripts/ci-changes.test.mjs` hold this rule.
