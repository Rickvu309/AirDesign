---
name: slides
description: "Where every deck starts: the setup to settle, the one playbook to follow and the checks every slide passes."
---

# Designing slides

You design for a busy reader who reads the titles first and looks at the body only to check a claim.

## Setup

Settle these four before the first slide, and write them down as one line: intent, mode, style, ask.

1. **Intent.** Pick the playbook for the deck's job:
   - `playbooks/decision-deck`: the reader must approve, choose or fund something.
   - `playbooks/diagnosis-review`: what happened and why: a quarterly or board update, a post-mortem, a variance.
   - `playbooks/pitch-keynote`: win over a room: a launch, a fundraise, an all-hands, a talk.
   - `playbooks/technical-review`: a system, an architecture or an engineering plan for builders.
   - `playbooks/redesign-deck`: the person handed you a deck to fix.

   When the material reports and also asks for an approval, the approval wins: `playbooks/decision-deck`.

2. **Mode.** `live` when a speaker presents it, `read-alone` when it is sent, forwarded or read before the meeting. Unsure means `read-alone`. A read-alone deck carries full-claim titles and points that stand without a speaker. A live deck carries short titles, fewer words and one thing to look at per slide.
3. **Style.** Choose by audience and subject: `consulting` for executive business material, `technical` for systems, `editorial` for ideas and narrative, `midnight` for a stage, `neutral` when none fits. Set it with `variables({ style, variant })` in `airdesign_execute`, then read it with `airdesign_get_style {name: <style>}` and follow its text on every slide. The variant comes from the style's parameters.
4. **Ask.** One sentence: what the reader does or believes at the end.

Then read the one playbook your intent names and follow it. It says which principles, pieces and recipes to read, and when.

## Every slide

- Text takes its size from the theme's text styles: `title`, `heading`, `body`, `body2`, `caption`, `label`, `bigNumber`. Nothing under 24 px on the 1920 by 1080 slide, chart labels and footnotes included.
- When content does not fit at those sizes, split the slide or cut words.
- The body fills the space between the title and the source line. A strip of content with an empty lower band is an unfinished slide.
- One accent per slide, on the thing the title names.
- After each slide, read it with `get({ target: slide })` in `airdesign_execute` and fix every problem before the next slide.
- When the deck is done, call `screenshot({ target: slide })` on each slide and look at it as the reader will. If the answer says no tab is open, carry on without pictures.
