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
heavy --label design-parity-tests -- npx vitest run bench/design-parity
```

The command builds Site and Studio and starts the existing real local API/PostgreSQL fixture with local agent and payment adapters. It closes its browser, servers, connections and database in teardown. Chromium must be installed for Playwright. PostgreSQL defaults to the existing local socket configured by the fixture; use AIRDESIGN_PG_HOST and AIRDESIGN_PG_USER for another local setup.

The default output directory is `~/tmp/airdesign-design-parity/<git-sha>/`. `report.html` shows design left and product right, worst ratios first. `report.json` records the exact ratio, budget, viewport, dimensions, fonts, fixture and ordered steps. Each captured screen has `capture.png`, `design.png`, `side-by-side.png`, and `diff.png`. Open every affected side-by-side. A lower ratio is evidence to inspect, not proof of usability or pixel equivalence.

A run fails for capture errors or any ratio above the screen budget. Unreachable screens remain explicitly listed coverage gaps; they do not mean parity passed for those screens. Only product states that cannot be reached may be unsupported; a missing harness fixture is an error to fix. Review coverage before accepting a run.

The single scenario list is `bench/design-parity/scenarios.json`. Its typed contract and validation live in `registry.ts`. Budgets round upward to six decimal places; `--update-budgets` only lowers them. `budget-baseline.json` retains the initial measured ceiling. Validation also compares the last committed registry so an already lowered ceiling stays lowered. The test rejects increases unless `budgetRaisedBecause` documents the reviewed exception. An explanation is never permission to raise a budget to hide a regression.

Never edit authoritative design images. Never raise a budget to pass. Never change a scenario's steps, seed content, screenshot area, masks or comparison settings to dodge a diff. Preserve the intended state when improving fixtures. Capture errors must be fixed or reported as failures; do not relabel them unsupported. Design revisions require explicit operator direction and a reviewed baseline change.
