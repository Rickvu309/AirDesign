# Council brief, round 2: AirDesign landing page (S11.01 v4)

Read-only review. Do not edit any file outside `/tmp/strat/landing/council/`.

Read `/tmp/strat/landing/council/brief.md` first for the product, audience and binding direction. They still apply.

## What changed since round 1
Round 1 scores were Codex 6.5, Grok 6, Opus 6. Agreed changes applied:
- One Halden case everywhere. Hero rewrite, title rewrites, pyramid, storyline and decision all come from the same Q3 board review. Governing thought: "Keep the growth plan. Review hiring in Q1." Reasons: Growth (Enterprise carried the quarter), Quality (Mid-market churn is down to 4%), Capacity (Hiring can wait one quarter).
- Hero: one 680px slide with the struck label "Q3 revenue by segment" rewritten as "Enterprise carried the quarter", selection with handles, one small Aira card. Badge, chips and stacked back slides are gone. New sub copy.
- "In short" strip now maps to sections 02, 05 and 06.
- Storyline: the dimmed card wall is gone. The eight titles are a 40px paragraph with slide numbers; the current one is underlined in blue.
- Placeholder blocks replaced with real micro content (decision columns, falling churn line, capacity table, evidence pills with page numbers).
- Review: 360px draft with red pen, 720px result. Title "North and East bring 83% of next year's growth", "Projected increase" column, callout "$22.5M of the $27.1M projected increase", 12px minimum.
- PowerPoint: one exhibit, the slide open in PowerPoint with its chart selected and a notes pane, four numbered pins with notes.
- Agents: one row, Claude and Codex on neutral #222 tiles; MCP bar removed.
- Close: dithering shader (sphere, 4x4, #0F2433 to #4D94FB) rising behind an empty "Your answer goes here" field with a caret, fading to flat navy before the title. The lead names "$5". The placeholder slide 08 is gone.
- Live shader prototype in code, using the real `@paper-design/shaders` 0.0.82: a PulsingBorder in blue, light blue and soft violet around the hero slide, and Dithering in the close. Screenshot: `/tmp/strat/landing/council/r2_shader_prototype.png`. Source: `/tmp/strat/landing/proto/index.html`.

## Look at
- Page: `/tmp/strat/landing/council/r2_part1.png` ... `r2_part6.png` (full: `/tmp/strat/landing/v4d.png`)
- Shader prototype screenshot and source above
- Generator: `/tmp/strat/ed/gen.mjs`, search `Landing v4`

## Return (under 500 words)
1. **Score out of 10**, same bar as round 1.
2. **What still blocks a 9**, ranked, at most 5 items, each with concrete values. Only changes inside the existing sections. No new sections or features.
3. **Shaders verdict:** keep, change or cut each of the two (PulsingBorder hero, Dithering close), with params if you would change them.
4. Anything we made worse since round 1.
