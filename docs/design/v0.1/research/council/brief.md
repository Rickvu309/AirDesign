# Council brief: AirDesign landing page (S11.01)

You are one of three council reviewers. Your job is read-only: look, judge, recommend. Do not edit any file outside `/tmp/strat/landing/council/`.

## Product
AirDesign is a slide tool for high-paid experts (consultants, strategy leads, founders, C-level) whose decks must win buy-in from top management or win a deal. The built-in agent is **Aira**; people can also connect Claude or Codex over MCP. Promise: every slide title states the answer, one point per slide, every number sourced; export an editable PowerPoint. Pricing: free with weekly usage; $5 resets.

## Owner's direction (binding)
- Landing page always takes the harder, more stunning, even "weird" option. Never a generic SaaS page.
- Audience: high-paid experts. Tone: confident, plain, consulting-native. No hype words, no fake logos, no fake stats, no testimonials we don't have.
- Palette is the paper.design palette: neutral grays (#222 to #F5F5F2), one blue #4D94FB (button gradient #93B8EF to #4D94FB), deck navy #0F2433 and teal for slide content. Red only for the red-pen marks on the draft slide. No warm tints, no orange glows.
- Copy: sentence case, short, no em dash, no middle dot.
- Sample companies are Halden and Brightwater, always labeled as sample data.
- The page is built like a board deck: answer first, three reasons, then proof, signposts "02 / 07" on each section.
- Ideas come from Herng Lee's guides (Pyramid Principle, headlines-only test, label vs headline, so-what, contextualize, strong/direct/crisp). Use the principles in our own words; never quote the books.
- Owner wants us to explore paper.design shaders (https://github.com/paper-design/shaders: MeshGradient, GrainGradient, Dithering, PaperTexture, StaticMeshGradient, NeuroNoise, Metaballs, Warp, Waves, GodRays, SmokeRing, PulsingBorder, Heatmap, LiquidMetal, ImageDithering, HalftoneDots, etc.) where they make the page more striking without breaking the palette or readability.

## What to look at
- Current page render, 1440 wide, top to bottom: `/tmp/strat/landing/council/r1_part1.png` ... `r1_part7.png` (full image: `/tmp/strat/landing/v3d.png`).
- Generator source (JSX-like strings), landing v3 near the end: `/tmp/strat/ed/gen.mjs` (search for `Landing v3`).
- Design rules: `/Users/quanvu/Design Stuff/airdesign-planning-push/docs/design/v0.1/tokens.md` and `components.md` (section "Landing page parts").

## What to return (keep it under 700 words)
1. **Score out of 10** for the page as it stands, against the bar "stunning, memorable, credible to a McKinsey partner or a CFO".
2. **Top 5 changes**, ranked by impact. For each: section, what to change, why, and concrete values (copy, size, color, layout). Prefer changes that raise ambition, not more sections.
3. **Shaders:** at most 2 places where a paper.design shader would earn its place. Name the shader, its colors (from the palette) and key params, and what it must never do (e.g. sit behind body text).
4. **Cut list:** anything that should go because it is weak, repeated, or generic.
5. One line: the single biggest risk to credibility with this audience.

Be blunt. Do not propose new product features. Do not add sections unless one replaces another.
