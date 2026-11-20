# A bug you find and do not fix is an `it.fails` test. A skipped, todo, expected-failure or no-expect test counts as a known failure

`scripts/metrics.mjs` prints the count on every run. A known failure is shown, never blocked. A deleted test is caught only by the `mutation` job, which reports the planted faults that tests no longer catch
