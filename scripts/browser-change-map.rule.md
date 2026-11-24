# Browser-only changes run the specs that reach them, and PDF runs for its inputs

The change map follows imports and literal fixture paths from each current browser spec. It gives each PR browser job an exact file list when the changes are confined to browser specs and their dependencies. Unmapped browser inputs and shared setup run the full browser suite. Shared setup includes the Playwright config, launch, preview server, decks and API stack fixtures, their dependencies and the spec timings. One job takes up to 120 recorded spec seconds. Larger selections use the same weighted split as a full browser run, up to the configured number of browser jobs. A spec without a timing record weighs the median.

The PDF job runs for the export spec, its browser helpers, shared setup, the validator scripts and changes that reach the app or API. Pushes and merge groups keep the full browser matrix. `change-map.test.mjs`, `ci-changes.test.mjs` and `check.test.mjs` hold the selection and execution.
