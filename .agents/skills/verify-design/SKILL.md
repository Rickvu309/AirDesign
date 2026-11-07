---
name: verify-design
description: Compare built AirDesign screens with the authoritative v0.1 design images, inspect visual gaps, and prevent regressions with ratcheting budgets.
---

# Verify design

Use after a screen, shared style, font, UI copy, or deployment changes. This local harness checks the built checkout; a local pass alone does not verify the deployed service.

Run from the repository root:

```bash
heavy --label design-parity -- npm run verify:design
heavy --label design-parity -- npm run verify:design -- --only S11.01,S21.01
heavy --label design-parity -- npm run verify:design -- --out "$HOME/tmp/airdesign-design-review"
heavy --label design-parity -- npm run verify:design -- --update-budgets
heavy --label design-parity -- npm run verify:design -- --strict
heavy --label design-parity-tests -- npx vitest run bench/design-parity
```

The command builds Site and Studio and starts the existing real local API/PostgreSQL fixture with local agent and payment adapters. It closes its browser, servers, connections and database in teardown. Chromium must be installed for Playwright. PostgreSQL defaults to the existing local socket configured by the fixture; use AIRDESIGN_PG_HOST and AIRDESIGN_PG_USER for another local setup.

The default output directory is `~/tmp/airdesign-design-parity/<git-sha>/`. `report.html` shows design left and product right, worst drift scores first. `report.json` records the drift score, its global and worst-region scores, perceptual color and foreground/edge/dimension/background terms, secondary raw ratio, target, distance to target, budget, viewport, dimensions, fonts, fixture and ordered steps. Each captured screen has `capture.png`, `design.png`, `side-by-side.png`, and `diff.png`. Open every affected side-by-side. A lower drift score is evidence to inspect, not proof of usability or pixel equivalence.

A normal run fails for capture errors or drift above the screen budget. `--strict` also fails when drift exceeds a screen target or any screen is unreachable; it is the release bar. CI uses the normal budget gate. A budget pass can still mean large design drift. Unreachable screens remain explicitly listed coverage gaps; they do not mean parity passed for those screens. Only product states that cannot be reached may be unsupported; a missing harness fixture is an error to fix. Review coverage before accepting a run.

The single scenario list is `bench/design-parity/scenarios.json`. Its typed contract and validation live in `registry.ts`. Budgets round upward to six decimal places; `--update-budgets` only lowers them. `budget-baseline.json` retains the initial measured ceiling. Validation also compares the registry at the merge base with `origin/main`, so committing a budget increase cannot erase the reviewed ceiling. Set `DESIGN_PARITY_BASE` to the PR base SHA in CI or another explicit target ref; an unavailable base fails closed. The test rejects increases unless `budgetRaisedBecause` documents the reviewed exception. An explanation is never permission to raise a budget to hide a regression.

Never edit authoritative design images. Never raise a budget to pass. Never change a scenario's steps, seed content, screenshot area, masks or comparison settings to dodge a diff. Preserve the intended state when improving fixtures. Capture errors must be fixed or reported as failures; do not relabel them unsupported. Design revisions require explicit operator direction and a reviewed baseline change.

The primary metric is `local-oklab-v2`, a score from zero (matching) to one (maximum drift). It retains the maximum of four legacy global terms: foreground color mismatch, edge loss, dimension loss and background color loss. Each image estimates its own background from its most frequent RGB color quantized in steps of 8 per channel. Foreground pixels differ from that background by more than 24 in any RGB channel. A foreground pixel matches when the other image has a color within 32 channel levels within 2 pixels; the union of foreground pixels is the denominator. This avoids white space and dim dialog overlays diluting differences. Edge loss is one minus the harmonic mean of bidirectional edge matches on half-size grayscale images, with a 1px matching radius. The edge threshold is 32. Dimension loss is one minus shared rectangular area divided by the padded frame area, so truncated full-page landing captures fail rather than disappear. Background color loss is the modal RGB distance beyond the 32-level color tolerance divided by 223. It catches uniform wrong backgrounds when both images have no edges. The perceptual term converts native-frame RGB pixels to OKLab. It matches foreground and background separately within 4px, tolerates distance 0.025, and scales excess distance continuously over 0.1, capped at one. A 12x8 grid scores both categories in every region; each category denominator has a floor of 3% of the region area so a few antialias pixels cannot dominate. The maximum category loss is the region score. The global score is the maximum of the legacy terms and the frame perceptual loss. The final score is the maximum of the global score and the worst region. Reports retain the worst column, row, counts and penalties. A missing heading or wrong button therefore cannot disappear into the frame average. Pixelmatch's full-frame ratio remains secondary.

Reproduce calibration against a saved capture directory:

```bash
heavy --label design-calibration -- node bench/design-parity/calibrate.mjs CAPTURE_DIRECTORY "$HOME/tmp/airdesign-design-calibration"
```

Calibration scores all designs after a 1px down/right shift and sigma 0.3 antialias blur, then renders two unchanged editor generator outputs through Tailwind and the same Chromium at 1470x923. The generator prefix through the two editor outputs runs with in-memory file adapters; its historical `/tmp` paths are never written. Fonts come from the shipped Geist assets. Inspect source renders before treating generator differences as raster noise. The committed `calibration.json` records all 52 faithful perturbations, both source renders, and the per-surface thresholds: 0.02 for Site and 0.53 for Studio. Shift/blur maxima are 0.005892 and 0.287357; source Grid is 0.489313 and Agent Working is 0.510630. Pink tint scores 0.643195 and erased heading 0.990942, both over the Studio target. `targets.ts` is the sole release target table. Each threshold is the faithful maximum rounded upward to hundredths plus 0.01; tests bind the constants, record and every scenario target together. Editor source differences include separators, notes surfaces, font weights and selection outlines; this allowance is conservative source reproduction, not a claim that all differences are raster noise. Do not derive thresholds from current product drift. The version change migrates regression ceilings to new metric units once; subsequent ceilings only decrease.

The checked-in small fixtures preserve actual Recents and overlay-dialog comparisons. Behavioral tests reject the original full-frame dilution, accept faithful perturbations, score unequal page dimensions, and distinguish strict targets from regression ceilings. Metric versions are part of each scenario: the one-time raw-ratio migration cannot compare ceilings expressed in different units. Future ceilings in this version only decrease.


`scenario-lock.json` commits seed, ordered steps, viewport, surface, route, status and DOM assertions for every scenario. Validation compares it with the merge base. Identity changes require `scenarioChangedBecause`; removing coverage or changing a reachable state to unreachable fails even without strict mode. Assertions require visible copy-kit text, named accessible controls and a working interaction probe. The runner checks entry copy and interaction, performs the scenario steps, then checks final-state copy and controls before capture. Approval probes create a fresh approval after consuming the first, keeping the existing signed-in session. A design bitmap alone fails both copy and interaction checks. Update the lock only for an intentional, explained state change.

Run the history and DOM behavior tests with the metric tests. They reproduce a committed budget increase in a temporary repository, reject an unexplained identity change and coverage loss, reject the bitmap probe, and fail a broken control. The checked-in pink and erased-heading fixtures preserve the adversarial metric regressions. Repeat affected captures and compare both image hashes and scores before accepting deterministic results.
