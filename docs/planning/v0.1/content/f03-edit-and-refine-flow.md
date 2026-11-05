# F03 Edit And Refine Flow

AirDesign / v0.1 / F03

F03 Edit and refine

Select and ask, watch it edit, see what changed. The same loop for Aira and the person's own agent, and the person can edit by hand at any time.

Screen

Other flow or outside

Decision

ask again

yes

used up

some weekly usage left

stopped or failed

done

S40 Editor

1 Select and ask

The selection goes with the request. Nothing selected means the whole deck.

Any usage left?

F07

Usage and resets

X3 Your agent app

Or ask your own agent

S40 Editor, agent editing

2 Watch it edit

Changes land live. The person can keep editing, add to the request, or stop.

F15

Changes so far stay

S40 Editor, run done

3 See what changed

The activity line opens to changes by slide. A quiet Undo under the reply undoes the whole run.

F04

Export to PowerPoint

How an edit works inside

The agent picks the tools and the order. AirDesign makes every change safe, visible and undoable.

Read

Find the person's decks, know a deck, find things across it. get_context gives the active deck, selection, brand and preferences.

get_deck

get_slide

get_context

get_brand

find_elements

list_decks

Module: deck, brand

Files

Find the person's files, stock photos and icons. Read and add files, placed with apply_changes by file id. Import and export. Slow work returns an operation id.

search_assets

get_operation

read_file

add_file

export_deck

import_deck

Module: files, pptx

Change

Start a deck, change it with one change set (insert, set, move, remove), undo a named change, or update a brand. A look is applied as a change set.

apply_changes

create_deck

update_brand

undo_change

Module: change-log, brand

See

Look at the slide as it really renders.

capture_slide

Module: capture

Check

Overflow, contrast, off brand, PowerPoint fit.

check_deck

Module: lint

On every apply_changes

1

All or nothing

A change set applies whole or not at all. Bad ids or shapes come back as a clear error the agent can fix.

2

The person wins

Each change names the version it was based on. An agent change is refused if anything it touches changed since, and the agent re-reads. The person's edits always land, in the order they arrive.

3

Tagged to the run

Every change carries its run, so Undo run removes only that run. Later edits by the person stay.

4

Live everywhere it is open

The change reaches every tab and connected agent with the deck open, tagged with who made it.

Steps and screens

Step

Screen

Route

What happens

Goes to

1 Select and ask

S40 Editor

/d/:id

The person selects slides or elements and asks for a change. The selection shows as chips in the message box, such as Slide 3 and Bar chart, and can be dropped. Nothing selected means the whole deck. The deck and selection are captured when the message is sent. Asking checks weekly usage.

2, or F07

Or ask your own agent

X3 Your agent app

outside

Claude, Codex or any MCP agent. It reads the same selection and its edits show in the open editor the same way: the slide being changed shows the working glow, with no name or label. The person stops it in their own agent app, or ends its connection in Settings, Agents, which stops it at once. Uses weekly usage too.

2

2 Watch it edit

S40 Editor

/d/:id

Changes land live, and the person can see what the agent is touching, saying and doing. They can keep editing anywhere, add to the request, or stop.

3, or F15

3 See what changed

S40 Editor

/d/:id

The gray activity line opens to changes by slide, with any outside the selection called out. Undo under the agent's reply removes the whole run. A stopped or failed run offers Resume, which continues the same request, and Undo. Checks run again.

1, or F04

Screens: S40 Editor (S41.01 to S43.07). X3 Your agent app is reused from F02.

When something goes wrong

Request unclear

The agent decides: it may ask the person, or make its best attempt.

Asks again mid-run

The new message joins the running run and steers it, in every tab: each tab shows the one active run, so a message from another tab is shown as steering, never as a fresh request. No second run starts. With a User Agent, their app decides.

Same thing edited

The person wins. The agent change is refused, it re-reads and adapts, and says so.

Beyond the selection

Allowed. Those changes are called out in the summary.

Deck-wide change

Lands slide by slide, live. The person can stop at any slide and keep what is done.

Breaks PowerPoint fit

Deck health flags it. The agent sees the same flag and can fix it. Never blocked.

Undo after more edits

Undo run removes only that run. Items the person changed after it keep the person's version, and are listed.

Two agents at once

Each has its own run. If both change the same thing, the second change is refused and that agent re-reads.

Run fails midway

Changes so far stay. Undo run or Resume.

File cannot be read

Too big, locked or unknown type. read_file says why, and the agent tells the person.

Usage runs out midway

The current change finishes, then the run stops. The person can pay to reset (F07).

Rules

We never script the agent. It picks its tools and their order.

The selection is a hint, not a fence.

One request is one run, and one Aira run per deck at a time. Undo right after a run undoes the whole run. The person's own edits keep their own undo steps.

The person always wins. A property the person edits is protected from agent runs that started before the edit. Their next request may change it.

Every change is live, and the person can always see what changed.

The agent says what changed, by slide.

Same tools and same rules for Aira and User Agents.

Both agents use weekly usage; Aira uses it faster.

Checks inform, they do not block.

Targets: first change visible under 3 s. A one-slide edit done under 15 s.

Files: add_file takes a link, or returns an upload link for a local file. Links are fetched by the worker, public addresses only, with size and time limits. Nothing large goes through the agent chat. Every file is untrusted.
