# Key Components

AirDesign / v0.1

Modules

Individual first. Two promises: stunning slides with AI, and PowerPoint import and export with no loss.

Foundation, build first

XL

Relative size of work

rpc adapter

mcp adapter

mcp adapter

changes in, live updates out

same tools, in process

over HTTP

changes

styles

screenshots

check, review

import, export

locks

report

uses

uses

uses both

reads

Surfaces

The user, and the agent they choose

Core

Everything both promises need

Foundation

Build first, change rarely

surface

XL

Studio

Your canvas, account and usage. AI edits land live. Import and export PowerPoint.

option 1, built in

L

Aira (agent)

Claude Agent SDK on our server, our Claude key. Uses weekly usage as it runs, faster than a User Agent.

option 2, the user's own

M

User Agent

Claude and Codex at launch. Any MCP agent works. Connect over MCP.

core

access, usage

Two modules. access: who is this, and may they. usage: is there weekly usage left. Both agents use it; Aira uses it faster. Paid resets.

M

core

L

change-log

commit, watch, undo. Runs and live activity.

core

L

brand

Templates: colors, fonts, layouts. Also saved from PowerPoint.

core

M

capture

Screenshot and report in about 300 ms. PDF for export, PNG only for internal captures and thumbnails.

core

M

lint

Design quality and PowerPoint fit.

core

XL

pptx

Import and export. Native, kept or flagged.

foundation

XL

deck

Plain JSON, zero dependencies. Models what PowerPoint can say, plus auto layout.

apply(deck, changeSet) returns { deck, inverse } or an error

Four change kinds: insert, set, move, remove

deck/jsx: toJsx and fromJsx, loaded by the MCP adapter only

Any slide size

Element map by id

Shapes and groups

Short ids

Roles

Tailwind subset

Auto layout

Token refs

Layouts and slots

Data charts

Theme slots

Speaker notes and sections

PowerPoint text and placeholders

Original source kept

foundation

L

render

One React component. Same markup in studio and on the server.

Slide component: live in studio, one element updates at a time

render/server: snapshot(slide) to pixels or PDF, for capture, checks and export

render/measure: measure(root) returns the layout report, browser only

Fonts before measure

One layout read per pass

Allow list: native, approx, raster

Shape geometry as SVG

Autofit and metric-matched fonts

Gestures stay local

Cached thumbnails

Lines and boxes

Calls and data at runtime

Built on, imports code

Two ways to use AI

1. Aira

Built in. Claude API with the Claude Agent SDK, on our key. Nothing to set up.

2. User Agent

Any agent you already use, connected over MCP.

AirDesign is not a harness. It is the interface plus a toolbox over MCP. Aira runs on a harness we bring (Claude Agent SDK); a User Agent brings its own. Both get the same tools, so the slides come out the same.

Lean foundation rules

Plain JSON in memory, on the wire and in the database

No DOM or Node APIs in deck

Validate at adapters, trust inside

apply copies only what changed

Subpath exports keep bundles small

Also core: agent, catalog, files, skills, themes, jobs. The full list is on the Monorepo map.
