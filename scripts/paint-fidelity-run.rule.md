# The paint-fidelity count covers the corpus it names

`scripts/paint-fidelity-run.mjs` scores every fidelity reference against PowerPoint, counting matches with fonts present. `fidelityFailure` refuses crashes, empty, skipped, timed-out or regressed runs (`scripts/paint-fidelity.test.mjs`); `metrics.json` records the count. Higher counts print `record`. `--reference libreoffice` reports without that ratchet. `scripts/ci-crashes.test.mjs` forbids `continue-on-error`
