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

The default output directory is `~/tmp/airdesign-design-parity/<git-sha>/`. `report.html` shows design left and product right, worst drift scores first. `report.json` records the drift score, its foreground/edge/dimension/background terms, secondary raw ratio, target, distance to target, budget, viewport, dimensions, fonts, fixture and ordered steps. Each captured screen has `capture.png`, `design.png`, `side-by-side.png`, and `diff.png`. Open every affected side-by-side. A lower drift score is evidence to inspect, not proof of usability or pixel equivalence.

A normal run fails for capture errors or drift above the screen budget. `--strict` also fails when drift exceeds a screen target or any screen is unreachable; it is the release bar. CI uses the normal budget gate. A budget pass can still mean large design drift. Unreachable screens remain explicitly listed coverage gaps; they do not mean parity passed for those screens. Only product states that cannot be reached may be unsupported; a missing harness fixture is an error to fix. Review coverage before accepting a run.

The single scenario list is `bench/design-parity/scenarios.json`. Its typed contract and validation live in `registry.ts`. Budgets round upward to six decimal places; `--update-budgets` only lowers them. `budget-baseline.json` retains the initial measured ceiling. Validation also compares the last committed registry so an already lowered ceiling stays lowered. The test rejects increases unless `budgetRaisedBecause` documents the reviewed exception. An explanation is never permission to raise a budget to hide a regression.

Never edit authoritative design images. Never raise a budget to pass. Never change a scenario's steps, seed content, screenshot area, masks or comparison settings to dodge a diff. Preserve the intended state when improving fixtures. Capture errors must be fixed or reported as failures; do not relabel them unsupported. Design revisions require explicit operator direction and a reviewed baseline change.

The primary metric is `foreground-edges-v1`, a score from zero (matching) to one (maximum drift). It takes the maximum of four terms: foreground color mismatch, edge loss, dimension loss and background color loss. Each image estimates its own background from its most frequent RGB color quantized in steps of 8 per channel. Foreground pixels differ from that background by more than 24 in any RGB channel. A foreground pixel matches when the other image has a color within 32 channel levels within 2 pixels; the union of foreground pixels is the denominator. This avoids white space and dim dialog overlays diluting differences. Edge loss is one minus the harmonic mean of bidirectional edge matches on half-size grayscale images, with a 1px matching radius. The edge threshold is 32. Dimension loss is one minus shared rectangular area divided by the padded frame area, so truncated full-page landing captures fail rather than disappear. Background color loss is the modal RGB distance beyond the 32-level color tolerance divided by 223. It catches uniform wrong backgrounds when both images have no edges. Pixelmatch's full-frame ratio remains secondary. These tolerances admit tiny raster differences, not layout changes.

Reproduce calibration against a saved capture directory:

```bash
heavy --label design-calibration -- node bench/design-parity/calibrate.mjs CAPTURE_DIRECTORY "$HOME/tmp/airdesign-design-calibration"
```

Calibration scores all designs after a 1px down/right shift and sigma 0.3 antialias blur, then renders two unchanged editor generator outputs through Tailwind and the same Chromium at 1470x923. The generator prefix through the two editor outputs runs with in-memory file adapters; its historical `/tmp` paths are never written. Fonts come from the shipped Geist assets. Inspect source renders before treating generator differences as raster noise. The calibrated targets are 0.02 for site and 0.12 for Studio. Across all 52 shifted/blurred designs, the maximum is 0.004827 on site and 0.036562 on Studio. Editor source renders score 0.071263 (Grid) and 0.105210 (Agent Working); their remaining generator-to-PNG differences include separators, notes surfaces and selection outlines, so this is a conservative source-reproduction allowance, not a claim that all of it is raster noise. The calibration JSON retains each metric term. Do not loosen targets from current product drift.

The checked-in small fixtures preserve actual Recents and overlay-dialog comparisons. Behavioral tests reject the original full-frame dilution, accept faithful perturbations, score unequal page dimensions, and distinguish strict targets from regression ceilings. Metric versions are part of each scenario: the one-time raw-ratio migration cannot compare ceilings expressed in different units. Future ceilings in this version only decrease.
