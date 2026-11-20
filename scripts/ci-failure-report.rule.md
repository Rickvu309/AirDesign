# A crash of the failure report shows red, never green. The report is not a required check, so a red run blocks no merge (`main` requires only `ci`)

`scripts/ci-failure-report.test.mjs` fails when a step of the `ci-failure-report` job sets `continue-on-error`
