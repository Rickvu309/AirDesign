# Local check time and CI wall time are told apart

`gate-duration` and `check-duration` are local seconds (`scripts/gate.mjs`, `scripts/check.mjs`). `ci-duration` warns over its merge-queue minute limit (`scripts/ci-duration.test.mjs`)
