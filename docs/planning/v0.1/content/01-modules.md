_AirDesign / v0.1_

# Modules

Individual first. Two promises: stunning slides with AI, and PowerPoint import and export with no loss.

Legend: dark box = foundation, build first. Size tag = relative size of work (M, L, XL). Solid line = calls and data at runtime. Dashed line = built on, imports code.

## Surfaces

The user, and the agent they choose.

| Surface | Size | What it is |
|---|---|---|
| Studio | XL | Your canvas, account and usage. AI edits land live. Import and export PowerPoint. |
| AirDesign Agent (agent), option 1, built in | L | Claude Agent SDK on our server, our Claude key. Reserves credits before each run. |
| User Agent, option 2, the user's own | M | Claude, ChatGPT, Cursor, Codex. Connect over MCP. |

How surfaces reach the core:

- Studio, through the rpc adapter: changes in, live updates out.
- AirDesign Agent, through the mcp adapter: same tools, in process.
- User Agent, through the mcp adapter: over HTTP.

## Core

Everything both promises need.

| Module | Size | What it does |
|---|---|---|
| access, usage | M | Two modules. access: who is this, and may they. usage: is there budget. Credits for AirDesign Agent, rate limits for User Agents. |
| change-log | L | commit, watch, undo. Runs and live activity. |
| brand | L | Styles, layouts, fonts. Also built from PPTX themes. |
| capture | M | Screenshot and report in about 300 ms. PDF, PNG. |
| lint | M | Design quality and PowerPoint fit. |
| pptx | XL | Import and export. Native, kept or flagged. |

Links from access and usage into the core: changes (change-log), styles (brand), screenshots (capture), check and review (lint), import and export (pptx). brand locks into change-log. capture reports to lint.

Also core: agent, catalog, files, skills, themes, jobs. The full list is on the Monorepo map.

## Foundation

Build first, change rarely.

### deck (XL)

Plain JSON, zero dependencies. Models what PowerPoint can say, plus auto layout.

- apply(deck, changeSet) returns { deck, inverse } or an error
- Four change kinds: insert, set, move, remove
- deck/jsx: toJsx and fromJsx, loaded by the MCP adapter only

Includes: any slide size, element map by id, shapes and groups, short ids, roles, Tailwind subset, auto layout, token refs, layouts and slots, data charts, theme slots, speaker notes, PowerPoint text and placeholders, original source kept.

### render (L)

One React component. Same markup in studio and on the server.

- Slide component: live in studio, one element updates at a time
- render/server: snapshot(slide) to pixels or PDF, for capture, checks and export
- render/measure: measure(root) returns the layout report, browser only

Includes: fonts before measure, one layout read per pass, allow list (native, approx, raster), shape geometry as SVG, autofit and metric-matched fonts, gestures stay local, cached thumbnails.

Who uses the foundation: change-log uses deck. capture uses render. pptx uses both. render reads deck.

## Two ways to use AI

1. AirDesign Agent. Built in. Claude API with the Claude Agent SDK, on our key. Nothing to set up.
2. User Agent. Any agent you already use, connected over MCP.

AirDesign is not a harness. It is the interface plus a toolbox over MCP. The AirDesign Agent runs on a harness we bring (Claude Agent SDK); a User Agent brings its own. Both get the same tools, so the slides come out the same.

## Lean foundation rules

- Plain JSON in memory, on the wire and in the database
- No DOM or Node APIs in deck
- Validate at adapters, trust inside
- apply copies only what changed
- Subpath exports keep bundles small
