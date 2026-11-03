_AirDesign / v0.1 / F02_

# F02 First deck

Describe it to the AirDesign Agent or ask your own agent. Either way the agent works freely on the canvas. We give tools and checks, never a script.

## Flow

- **1 Or ask your own agent** (X3 Your agent app)
- **Connected?**
- **Connect your agent** (F06)
- **1 Describe it** (S04 Home): One prompt, notes optional. Draft saved.
- **Any credits left?**
- **Credits and plan** (F07)
- **2 Watch the agent work** (S05 Editor, agent working): It decides how: plan, draw, check, redo. Every change lands live. The person can join in or stop.
- **Work so far stays. Resume.** (F15)
- **3 Review the deck** (S05 Editor, done): The agent's own summary. Deck health from our checks.
- **Edit and refine** (F03)
- **Export to PowerPoint** (F04)

Arrow labels: yes, no credit check; no; yes; none left; stopped or failed

## Steps and screens

| Step | Screen | Route | What happens | Goes to |
|---|---|---|---|---|
| 1 Describe it | S04 Home | /home | The person says what the deck is for, with notes or a document if they have them. This creates a draft deck and checks credits. First visit adds starter credits and the other ways in: import a PowerPoint, use my own agent. | 2, or F07 |
| 1 Or ask your own agent | X3 Your agent app | outside | In Claude Code, Cursor or any MCP agent. The agent creates the deck and shares its link. Opening it shows the same live editor. Not connected yet: F06. No credits, only rate limits. | 2, or F06 |
| 2 Watch the agent work | S05 Editor | /d/:id | The agent works its own way and every change lands live. The person sees what it says and does, and can edit alongside or stop. | 3, or F15 |
| 3 Review the deck | S05 Editor | /d/:id | The agent says what it did. Our checks report overflow, contrast and PowerPoint fit. Next: edit and refine, or export. | F03 or F04 |

New codes in F02: S05 Editor, X3 Your agent app. S04 Home is reused from F01. Next free codes are S06 and X4.

## When something goes wrong

| Item | Detail |
|---|---|
| Prompt too vague | The agent decides: it may ask the person, or make its best attempt. |
| Run fails midway | Work so far stays. The person is told what failed and can resume. |
| Credits run out midway | The agent finishes the current change, then stops. The person goes to F07. |
| Their agent is not connected | The agent gets a sign-in link from AirDesign. F06 runs, then the request carries on. |
| They close the tab | The run keeps going on the server. The deck is ready when they return. |
| Notes too long | The agent says what it used and what it skipped. |
| No images to use | The agent uses free stock photos and icons (F12), or layouts without photos. |

## Rules

- We do not script the agent. No forced outline, steps or layouts. It decides how to work.
- We give it tools, guidance it can read, and checks it can run. Nothing more.
- AirDesign Agent: the only check before a run is that some credit is left. The run spends as it goes and stops at the limit (F07). Starter credits always cover the first deck. User Agents spend no credits, only rate limits.
- At the limit, the current change finishes and the run stops. Work so far stays. The person can top up and carry on.
- The person sees what the agent says and does, as it happens.
- The person can stop any run any time, from either agent, and keep the work so far.
- The person can edit while the agent works. The agent never overwrites their changes.
- Our checks are shown to the person as deck health. They inform, they do not block.
