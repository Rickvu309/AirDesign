# F02 First Deck Flow

AirDesign / v0.1 / F02

F02 First deck

Describe it to Aira or ask your own agent. Either way the agent works freely on the canvas. We give tools and checks, never a script.

Screen

Other flow or outside

Decision

yes, some weekly usage left

no

yes

used up

stopped or failed

X3 Your agent app

1 Or ask your own agent

Connected?

F06

Connect your agent

S31 Home

1 Describe it

New deck, then one prompt in the agent panel. Draft saved as Untitled until it has a title.

Any usage left?

F07

Usage and resets

S40 Editor, agent working

2 Watch the agent work

It decides how: plan, draw, check, redo. Every change lands live. The person can join in or stop.

F15

Work so far stays. Resume.

S40 Editor, done

3 Review the deck

The agent's own summary, with a quiet Undo.

F03

Edit and refine

F04

Export to PowerPoint

Steps and screens

Step

Screen

Route

What happens

Goes to

1 Describe it

S31 Home

/home

The person says what the deck is for, with notes or a document if they have them. New deck opens the editor and the person describes the deck to Aira. It checks weekly usage. The other ways in: import a PowerPoint, use my own agent.

2, or F07

1 Or ask your own agent

X3 Your agent app

outside

In Claude, Codex or any MCP agent. The agent creates the deck and gives the person its editor link, which only the owner can open. Not connected yet: F06. Uses weekly usage too.

2, or F06

2 Watch the agent work

S40 Editor

/d/:id

The agent works its own way and every change lands live. The person sees what it says and does, and can edit alongside or stop.

3, or F15

3 Review the deck

S40 Editor

/d/:id

The agent says what it did. Our checks report overflow, contrast and PowerPoint fit. Next: edit and refine, or export.

F03 or F04

Screens: S42.01 agent working, S42.02 run complete, S42.03 your agent editing. X3 Your agent app is outside AirDesign.

When something goes wrong

Prompt too vague

The agent decides: it may ask the person, or make its best attempt.

Run fails midway

Work so far stays. The person is told what failed and can resume.

Usage runs out midway

The agent finishes the current change, then stops. The person can pay to reset (F07) or wait for the weekly reset.

Their agent is not connected

The agent gets a sign-in link from AirDesign. F06 runs, then the request carries on.

They close the tab

The run keeps going on the server. The deck is ready when they return.

Notes too long

The agent says what it used and what it skipped.

No images to use

The agent uses free stock photos and icons (F12), or layouts without photos.

Rules

We do not script the agent. No forced outline, steps or layouts. It decides how to work.

We give it tools, guidance it can read, and checks it can run. Nothing more.

Both agents: the only check before a run is that some weekly usage is left. The run uses it as it goes and stops at the limit (F07). A fresh week always covers the first deck. Aira uses usage faster than a User Agent.

At the limit, the current change finishes and the run stops. Work so far stays. The person can pay to reset and carry on.

The person sees what the agent says and does, as it happens.

The person can stop any run and keep the work so far: Aira from its message box, a User Agent from its own app or by ending its connection in Settings, Agents.

The person can edit while the agent works. The agent never overwrites their changes.

Our checks feed the agent, which tells the person what needs a look. They inform, they do not block.
