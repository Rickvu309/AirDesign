# Monorepo Map

AirDesign / v0.1 / One repo

Monorepo map

Four apps you deploy, packages they share. Tags show where each package runs.

apps/

What gets deployed, one domain each

airdesign.app

apps/site

ui, guides

Landing, pricing, docs, connect guides for User Agents

Astro, static

studio.airdesign.app

apps/studio

deck, render, rpc

Home and Trash, editor with Aira, PowerPoint import and export, settings: usage, agents, account. No share links.

React, Vite

mcp.airdesign.app + studio /api

apps/server

core, agent, three adapters

One process. Three adapters over one core, shown below: rpc for studio, mcp for agents, billing for card and bank QR.

Node, Effect, Better Auth

internal only

apps/worker

capture, render, pptx, files

Headless Chromium and file work. Screenshots, sizes, PowerPoint import and export, reading attached files, PDF export, PNG for internal captures

Node, Playwright

apps/server/src

Adapters at the edge. The core stays in packages.

main.ts

wiring

Builds every module once and hands them to the adapters. Config and secrets enter here. Holds the mailer (Resend). Account deletion asks each module to remove its own data.

rpc/

studio

Mounts rpc/server on /api and /ws for studio.airdesign.app.

mcp/

agents

MCP adapter on mcp.airdesign.app. Tools from each module, skills, OAuth for User Agents.

billing/

Payment providers

Provider adapters behind one Payment: payOS hosted checkout for bank QR (owner's personal account), a card provider to be chosen. One-off payments only. Verifies each payment, then calls usage.addCredits.

packages/

Shared code, never deployed alone

Core, everything both promises need

agent

server

Runs Aira on a harness we bring: Claude Agent SDK, our key. No agent loop of our own. Usage limits

deck

everywhere

Deck, Slide, Element, Change. Owns its schemas

render

browser, server

render and measure slides

rpc

studio, server

Studio wire, both ends: ./client ./server. The client queues edits while offline

access

server

The person, sessions, profile and preferences, agent connections over OAuth

change-log

server

commit, watch, undo, compare, revert a slide. Runs, live activity and the person's selection

catalog

server

The person's decks: list, search, rename, duplicate, Trash and purge

brand

server

Tokens, layouts, assets, own history

capture

worker

Warm Chromium pool, screenshot, report, export

files

server, worker

Upload links to R2, limits, text and page extraction, image sizes, stock photo and icon search, the person's library

lint

server

Design quality and PowerPoint fit

pptx

server, worker

fromPptx and toPptx. Native, kept or flagged

usage

server

record, remaining, reset, addCredits, autoReset. Owns weekly usage, resets, the credit balance, storage limits, rate limits, low usage warnings

skills

server

Design guidance as recipes. One source for both agents. Agents may use them or ignore them

themes

everywhere

Curated themes and layouts that ship with AirDesign

jobs

server, worker

Postgres queue. Agent runs, imports, exports. Scheduled work: Trash purge, weekly usage reset, nightly usage check. Survives deploys, cancels, reports progress

Feature modules: none yet. Comments and versions come later as packages.

every module exports . ./mcp ./studio ./testing as it needs

next module

Comments, versions

ui

Design system for site and studio

guides

Agent connect guides, one source for site and studio, plus a plain text version for agents

config

TypeScript, lint and test presets

data

Where each module keeps its state

Railway Postgres

change-log entries and snapshots, catalog, template versions, access (accounts, preferences, connections), usage ledger, jobs queue, file records and import reports

Cloudflare R2

The person's image library, fonts, kept PowerPoint originals, exports, cached thumbnails

tests

Through the interface, never past it

Module laws

CI

*.test.ts next to each module

Property tests on deck: inverse undoes, fromJsx(toJsx(s)) equals s, ids never change.

Contract suites

CI

./testing per real seam

Fake capture, fake payments and test callers pass the same suite as the real adapters. change-log runs on PGLite.

Adapter scenarios

CI

apps/server/test

Same scenario through RPC and MCP ends in the same deck. Conflicts, concurrent edits, undo of one run.

Layout, pixels, PPTX round trip

CI

packages/render/parity

Layout reports as numbers. Pixel diff on reference slides against images from current PowerPoint on Windows and Mac, refreshed when PowerPoint changes. Real PPTX corpus round-tripped through LibreOffice on every change.

Lint corpus

CI

packages/lint/corpus

Known good and bad slides with the issues they must produce.

Agent replays

CI

evals/replays

Recorded Aira and User Agent sessions replayed against current tools.

Speed budgets

Main

bench/

Fixed runner. Fails on more than 20 percent regression, not on absolute numbers.

Agent evals

Label

evals/cases

Aira and User Agents on real deck tasks. Required when tools or skills change.

Builders in deck/testing keep tests readable. With no comments in code, tests are the docs.

stack

TypeScript everywhere, one schema language

Repo

TypeScript

pnpm workspaces

Turborepo

oxlint + own rules

Prettier

Site

Astro

Tailwind v4

packages/ui

Studio

React

Vite

TanStack Router

Zustand

Tiptap for text

Tailwind v4 for UI only

Server

Node

Effect

Effect Schema

Effect RPC over WebSocket

Effect McpServer

Better Auth

Sentry and OpenTelemetry, agent run traces

Resend for email

Card and VietQR payments

Weekly usage metering per person, both agents

Claude Agent SDK

Data and worker

Postgres

Drizzle migrations

R2 via S3 API

Playwright Chromium

Self-hosted fonts

pptxgenjs

Open-license icon set, self-hosted

Stock photo API, behind files

Tests

Vitest

fast-check

PGLite

Playwright

LibreOffice headless

evals/ harness

root

Beside the code

evals/

Aira and User Agents on real deck tasks

docs/

Decisions and specs

infra/

Deploy, domains, status page

bench/

Speed budgets on a fixed runner

Repo rules, checked by lint

Apps import packages. Packages never import apps.

Feature modules import core only, never each other.

site imports ui and guides only, so the landing page stays light.

Apps import modules directly. A mount list comes with the second feature module.

No comments in code. Names say what, tests say why.

Slides never compile Tailwind. deck/jsx maps agent classes to stored styles, render writes plain CSS.

Uploaded files are untrusted: PowerPoint, images, documents. Read in the worker, no external entities, size and zip limits.
