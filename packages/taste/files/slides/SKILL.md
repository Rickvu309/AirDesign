---
name: slides
description: "Where every deck starts: the setup to settle, the one playbook to follow and the checks every slide passes."
---

# Designing slides

You design for a busy reader who reads the titles first and looks at the body only to check a claim.

## Setup

Settle these four before the first slide, and write them down as one line: intent, mode, style, ask.

1. **Intent.** Pick the playbook for the deck's main job:
   - `playbooks/decision-deck`: getting a decision from executives is the main job: approve, choose or fund.
   - `playbooks/diagnosis-review`: a readout of what happened and why: a quarterly or board update, a survey, hiring status, operations metrics, a post-mortem. It stays here even when it ends with an ask.
   - `playbooks/technical-review`: a design, an architecture or an engineering plan for engineers, even when it asks for a go or no-go.
   - `playbooks/pitch-keynote`: a speaker wins over a room live: a launch, a fundraise, an all-hands, a talk.
   - `playbooks/redesign-deck`: the person handed you a deck to fix.
2. **Mode.** `live` when a speaker presents it, `read-alone` when it is sent, forwarded or read before the meeting. Unsure means `read-alone`. A read-alone deck carries full-claim titles and points that stand without a speaker. A live deck carries short titles, fewer words and one thing to look at per slide.
3. **Style.** Pick it from the job and the audience, never by habit:
   - A decision or review for executives: `consulting`.
   - A technical review: `technical`.
   - A pitch or talk presented live: `midnight` for a product or tech launch, `editorial` for a story, a brand or people.
   - A readout for a team, such as a survey, a hiring plan or operations: `neutral`.
   - A redesign: keep the deck's style unless it is broken; otherwise pick by its job.

   Set it with `variables({ style, variant })` in `airdesign_execute`, then read it with `airdesign_get_style {name: <style>}` and follow its text on every slide. The variant comes from the style's parameters.

4. **Ask.** One sentence: what the reader does or believes at the end.

Then read the one playbook your intent names and follow it. Read a principle only when its trigger in the playbook fires.

## The deck

- 5 to 8 slides, the cover included, unless the person asks for more. No appendix and no section dividers unless asked: detail goes in a table on the slide that needs it, or is left out.
- Say the recommendation once, up front; later slides prove it. The last slide is the ask or the next steps, with owners and dates, never a recap.

## Every slide

- Text takes its size from the theme's text styles: `title`, `heading`, `body`, `body2`, `caption`, `label`, `bigNumber`. Nothing under 24 px on the 1920 by 1080 slide, chart labels and footnotes included. When content does not fit, split the slide or cut words.
- Fill the body area, from under the title to above the source line, about y 280 to 960. The main chart, table or diagram is as tall as that space, not its natural height. A row of cards gets the exhibit that explains it below. An empty band over a quarter of the slide, or a slide with a few words, is unfinished: add the proof or merge it.
- One accent per slide, on the thing the title names.
- After each slide, read it with `get({ target: slide })` in `airdesign_execute` and fix every problem before the next slide.
- When the deck is done, call `screenshot({ target: slide })` on each slide and look at it as the reader will. If the answer says no tab is open, carry on without pictures.
