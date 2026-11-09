# Landing design alignment

The operator reported that the live landing did not match the design. The ranked audit and before images were saved before edits. S11.01 and S12.01 PNGs are authoritative; desktop captures use CSS width 1440 and phone captures width 390. There is no separate phone design PNG.

## Images read during verification

- [Landing before desktop](before-desktop.png) and [phone](before-phone.png)
- [Landing after desktop](after-desktop.png) and [phone](after-phone.png)
- [Landing design beside final desktop](design-after-desktop.png) and [phone](design-after-phone.png)
- [Pricing before](before-pricing.png), [after desktop](after-pricing.png) and [after phone](after-pricing-phone.png)
- [Pricing design beside final desktop](design-after-pricing.png) and [phone](design-after-pricing-phone.png)
- [Designed link regions](design-link-regions.png): Pricing in both landing header and footer; pricing header has an AirDesign home link and no Product link.

## Operator decisions

Landing and pricing reproduce the design copy, including unlimited decks, the weekly reset sentence, agent choice, hero callout and stats values. Exact text exceptions in the release-claims registry apply only to these two source pages. Tests reject the same claim on Status and Studio. Other surfaces retain their checks.

Privacy and Terms match the design as plain footer text until pages exist; tests prove they have no link hover, focus or cursor behavior, and site-audit remains unchanged for missing routes.

CTA labels stay dark on the gradient per the operator's earlier contrast decision. The product exhibit is a deterministic composition of the editor and Run 04 from the design generator, following the landing postprocessor; its manifest records source/output hashes and three rendering corrections (selected thumbnail title, notes background and SVG ring dash array). It is identified as an illustration, with no claim of actual capture provenance. Existing real-capture checks remain intact for the separate capture asset.

## Structure proof

Only two public structure contracts change. S11 requires one Pricing link in the header and one in the footer. S12 requires and probes the AirDesign home link in the header, without requiring a Product link absent from the PNG. Negative tests reject either missing Pricing link and an outside substitute for the header home link. The old contracts fail against the designed structure.

Targets, budgets, metric, parity fixtures and design images remain unchanged. S11 is uncalibrated because its generator source differs from its PNG; a numeric parity pass is not visual approval. The saved side-by-sides are read directly.

The design covers only landing and pricing as public routes. Existing agent guides, examples and status routes receive shared styling and responsive checks without adding pages.

## Final visual verification

The final desktop and phone comparisons above were read directly after the source exhibit, selected thumbnail title, notes bar, pricing row and strip arrows were restored. The final narrow pass restores 13px medium sans values in the stats strip, the pricing check stroke at the PNG’s blue pigment, and the exhibit’s pale ring with a blue sector. Both S11/S12 structure and pixel regression checks pass. Desktop section comparisons and their phone counterparts are retained in `~/tmp/airdesign-polish/owners/landing/design-alignment/final-sections`. The full frozen-head gate and natural PR checks are reported in the PR.
