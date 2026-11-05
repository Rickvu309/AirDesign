# Council brief, round 3: AirDesign landing page (S11.01 v7)

Record of the 2026-11-04 landing review. Use it for the decisions from that round. Instructions later in this file addressed that session's reviewers. Absolute paths and `~` paths name session inputs that are not in this repo. For the current landing handoff, read [tokens](../../tokens.md), [components](../../components.md) (Landing page parts), [MBB slide anatomy](../mbb-slide-anatomy.md).

Read-only review. Do not edit any file outside `/tmp/strat/landing/council/`.
Background, audience and binding direction: [brief.md](brief.md).

## Scores so far
Round 1: Codex 6.5, Grok 6, Opus 6. Round 2: Codex 7.5, Grok 7, Opus 7.5.

## What changed since round 2
- Owner asked that the sample slides look like real McKinsey, BCG and Bain slides. Notes: [mbb-slide-anatomy.md](../mbb-slide-anatomy.md). Hero, review result and PowerPoint slides now use one frame: tracker (current section filled navy), "SAMPLE DATA" sticker, action title, gray unit line, one exhibit with direct labels, navy totals, teal accent on the series that proves the title, mist gray context, numbered footnote, "Source: ...; Halden analysis", page number.
  - Hero: revenue bridge waterfall Q3 24 $4.1M to Q3 25 $5.7M (Enterprise +$1.06M teal with "66% of growth" callout, Mid-market +$0.35M, Self-serve +$0.19M, "+39% YoY" pill). The struck label "Q3 revenue by segment" sits directly above the 32px answer.
  - Review result: bar-in-table for projected increase, "North and East: $22.5M of $27.1M" bracket, navy takeaway box led by "$22.5M" at 38px.
  - PowerPoint: column chart with a "+39%" growth arrow, chart selected; file renamed "Halden Q3 board review.pptx"; ribbon with Layout and Font controls; pin 3 on the layout and font controls.
  - Pyramid cards renumbered 03, 05, 06 to match the storyline. Capacity uses Harvey balls against an 85% cap. Churn line labeled 6.2% to 4% with quarters.
- One decision sentence everywhere: "Keep the growth plan. Review hiring in Q1." (pyramid, rewrite row 4, storyline 01 and 08, speaker notes). The unsourced win-rate title was replaced with "Enterprise is 66% of the growth."
- Storyline paragraph shows the pyramid in color: 01 and 08 white, the three reasons (03, 05, 06) light, the supporting titles gray.
- Review draft: 420px, three rows at 12px, red ink without pink fill, top-aligned with the result.
- Close: the card is the Start free link (button inside it); the dithered dome is wider and rises behind the card.
- Prototype (`/tmp/strat/landing/proto/index.html`): the PulsingBorder runs about 2.4s while the title is rewritten, then fades out over 600ms. It is not mounted under reduced motion. Colors #4D94FB, #93B8EF, #CFE0FA. Dithering uses pxSize 3. Screenshots: `r3_shader_running.png` and `r3_shader_settled.png`. The prototype's hero still shows the older slide; judge only the shader behavior there.

## Look at
`/tmp/strat/landing/council/r3_part1.png` ... `r3_part6.png` (full page `/tmp/strat/landing/v7b.png`), the two prototype screenshots, generator `/tmp/strat/ed/gen.mjs` (search `Landing v5`).

## Return (under 400 words)
1. **Score out of 10**, same bar.
2. **Remaining blockers to a 9**, at most 4, concrete values, inside existing sections only. Say "none" if there are none.
3. **Do the sample slides now read as MBB-grade?** One line per slide (hero, pyramid cards, review result, PowerPoint).
4. **Satisfied?** yes or no, and why in one line.
