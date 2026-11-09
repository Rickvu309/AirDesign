# Landing alignment audit — 2026-11-09

> Historical audit before fixes. The operator subsequently required exact S11/S12 design copy and a design-source product illustration. Those decisions supersede the truthful-copy and real-capture recommendations below. Privacy and Terms remain visually matching plain text until destinations exist.

Base: main `4f71aa4ed51298c600a735acc1dc3e423e1b5175`, confirmed with GitHub API. Fresh branch `landing/design-alignment`. Live captures taken at desktop CSS width 1440 and phone width 390 after font/image readiness and scrolling every section. Browser desktop snapshots are capped at 1280 bitmap pixels; the composites normalize those to CSS pixels. Section positions were measured in the DOM. Before images are in `before/` beside this report. Design images and calibration remain untouched.

Authoritative public targets: S11.01 (landing, 1440×3924) and S12.01 (pricing, 1470×923), plus tokens/copy kit. No phone or other-public-route PNG exists in the design set; mobile is checked for the same hierarchy and usable responsive behavior. S11.01 has no valid calibrated score; these comparisons are visual judgments.

## Ranked differences, before fixes

1. **Product exhibit, desktop and phone — large.** Live depicts the old Studio: no thumbnail rail, oversized canvas, verbose tool-event log and chunky steer composer. The target has a clear outline rail, compact toolbar, selected slide in an airy workspace, restrained agent panel and bottom controls. The live phone crop cuts content off at the right edge. Refresh from the actual current Studio and label the sample accurately; never substitute the design PNG for a product capture. Evidence: product-side-by-side.png and product-phone-side-by-side.png.
2. **Primary buttons, every public route — clear.** Live uses a saturated royal-blue fill. Target uses the softer #93b8ef to #4d94fb gradient with a restrained rim. Header, hero and pricing all repeat this mismatch. Pricing-page-side-by-side.png makes it especially obvious.
3. **Phone header and hero balance — clear.** Header navigation wraps into a tall two-row pill; hero chart extends outside the viewport and the status bubble sits against the right edge. Keep touch targets, provide a deliberate compact layout and prevent accidental clipping. The desktop hero typography and major section starts already closely match; preserve them.
4. **Hero chart and badge — moderate.** Live chart has angular segments and a different trajectory/grid density from the smooth target. Badge width is fixed despite shorter truthful copy; its leader and placement differ. Live sample-data caption is extra, but its disclosure is necessary. Match the visual while keeping sample identification.
5. **Agent introduction — moderate.** Target has concise two-line supporting copy. Live has a long, caution-heavy sentence and different wrapping. Preserve truthful guide-only status in concise copy. Diagram geometry largely matches; avoid rebuilding it.
6. **Pricing copy and disclosures — intentional truth conflicts.** Layout/type/card placement largely match. Target says forever, unlimited decks, bring Claude or Codex, and pay to reset. Current proof supports weekly allowance, creation/editing, connection guides and no public paid reset. Retain truthful equivalents and necessary usage details while matching visual rhythm. Both landing and /pricing covered.
7. **Header/footer details — small.** Landing brand/nav divider and button padding differ. Footer substitutes Status & recovery for Privacy and Terms. Legal pages are absent; do not invent legal text. Match alignment and density while retaining available destinations.
8. **Quality strip and claims — intentional truth conflicts.** Target asserts zero follow-up questions, MECE pass, final ghost deck, 80→8 slides, 100% footnotes and EBITDA tied out. These are not proven capabilities. Existing sample/review language must remain truthful; improve density/alignment without claiming those outcomes.
9. **Motion/remaining layout — low.** No major section is missing or extra. Desktop hero/product/agent/pricing/footer starts match target closely. No decorative motion is needed to reproduce the still design. Preserve reduced-motion behavior and keyboard focus.

## Scope and conflicts for root

The design covers only landing and pricing as public routes. Existing /agents, /agents/claude, /agents/codex, /examples and /status receive shared visual fixes and regression checks, without invented target screens or new pages. Unproven claims above and unavailable Privacy/Terms remain explicit conflicts. Product layout fidelity depends on the actual current Studio UI; document any remaining difference rather than fabricating a capture.

## Saved comparisons

`before/hero-side-by-side.png`, `product-side-by-side.png`, `agents-side-by-side.png`, `pricing-side-by-side.png`, `footer-side-by-side.png`, corresponding phone composites, full landing desktop/phone, and `pricing-page-side-by-side.png` plus pricing phone capture.
