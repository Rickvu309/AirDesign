# Local check time and CI wall time are told apart

`gate-duration` and `check-duration` are local seconds (`scripts/gate.mjs`, `scripts/check.mjs`). `ci-duration` times the merge queue's run, or the push run on `main` when no queue run passed for that commit, and warns over its minute limit (`scripts/ci-duration.test.mjs`)
