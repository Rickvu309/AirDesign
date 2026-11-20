# A local browser run uses at most 4 workers

`playwright.config.ts` sets the count through `workerLimit` in `tests/browser-workers.ts`, and the `globalSetup` in `tests/browser/launch.ts` stops a larger `--workers` with one line unless `AIRDESIGN_BROWSER_WORKERS` is set. ci keeps Playwright's default, two workers on its four cores: four made each test about 1.7 times slower
