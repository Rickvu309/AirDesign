# Council brief, round 5: AirDesign landing page, full redesign (S11.01 v13)

Record of the 2026-11-04 landing review. Use it for the decisions from that round. Instructions later in this file addressed that session's reviewers. Absolute paths and `~` paths name session inputs that are not in this repo. For the current landing handoff, read [tokens](../../tokens.md), [components](../../components.md) (Landing page parts), [MBB slide anatomy](../mbb-slide-anatomy.md).

Read-only review. Do not edit any file outside `/tmp/strat/landing/council/`.

## Product and audience
AirDesign is a slide tool. Its built-in agent Aira builds board-ready decks: the title states the answer, one point per slide, every number sourced; export an editable PowerPoint; Claude or Codex can connect over MCP. Free weekly usage (resets Monday 8:00 AM); a reset costs $5 from credits (added from $10, never expire; auto reset optional).

## The owner's brief for this redesign (binding)
- Start over; the old approach is gone.
- Concept: editorial boardroom, like an annual report or a serious magazine.
- Audience first: consultants and strategy teams.
- One action: Start free.
- Bold and art-directed, light page. Serif headlines (Newsreader) with Geist for UI and body. Neutral paper #F5F5F2 and white, one blue (#2D6FCD / #4D94FB). No warm tints, no fake stats, no logos we do not have, no em dash or middle dot in copy.
- Sections must include real AirDesign product screens (they are live clones of the real screens, framed as numbered figures with captions) and pricing on the page.
- Shaders: Paper Shaders dithering used as printed halftone "plates" (hero and close). Credit "Shaders by Paper" in the colophon.
- We follow the Stageshow framing rules (`~/.claude/skills/stageshow/references/framing.md`): crop only filler, the hero figure runs off an edge, one satellite straddling an edge, no plate behind a figure.

## Look at
`/tmp/strat/landing/council/r5_part1.png` ... `r5_part6.png` (full page `/tmp/strat/landing/v13.png`). The real source screens: `/tmp/strat/landing/real/*.png`. Generator: `/tmp/strat/ed/gen.mjs`, search `Landing v13`.

## Return (under 450 words)
1. **Score out of 10** against: stunning, memorable, credible to a McKinsey partner.
2. **Top 5 changes**, ranked, concrete values (copy, sizes, layout). Judge hierarchy, layout, visual hook, copy, editorial craft and the figure framing.
3. **Shaders and art direction:** keep, change or add, at most 3, with params.
4. **Cut list.**
5. **Satisfied?** yes or no.
