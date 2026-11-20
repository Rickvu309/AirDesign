# A ci failure report names the thrown error, never "no failed test was named"

`land-report.mjs` and the `queue-drop` comment name each failed script test file with the error it threw (the scripts runner prints that error before its `fail <file>` line), and each failed step with the lines it printed: a rule's message, a TypeScript error, an oxlint error, a web server that did not start. `failed-tests.test.mjs` and `land-report.test.mjs` replay real job logs of each shape (`land-fixtures/job-*-failed.log`)
