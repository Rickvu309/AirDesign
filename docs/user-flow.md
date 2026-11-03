# User flow

Checked with TLA+ (TLC). Rules that hold: presenting shows nothing on top, canvas and inspector layout agree, Share needs a slide, a template never drops your work, leaving focus mode keeps the canvas, removing every slide ends presenting.

```mermaid
---
title: "AirDesign user flow"
---
stateDiagram-v2
  s0: Home, Drafts
  s1: Getting started dialog
  s2: Editor, slide view
  s3: Drafting deck with AI
  s4: Template gallery
  s5: Editor, slides overview
  s6: Presenting
  s7: Share dialog
  s8: Editor, empty deck
  s9: Invite sent
  s10: Share, more actions
  [*] --> s0
  s0 --> s1: you press Slides
  s0 --> s2: you open a draft
  s1 --> s2: you start from scratch
  s1 --> s3: you describe your deck
  s1 --> s4: you choose a template
  s2 --> s0: you go back home
  s2 --> s5: you open the overview
  s2 --> s6: you press play
  s2 --> s7: you press Share
  s3 --> s2: the draft is ready
  s4 --> s2: you use a template
  s4 --> s8: you close the dialog
  s5 --> s2: you open a slide
  s5 --> s6: you press play
  s5 --> s7: you press Share
  s5 --> s0: you go back home
  s6 --> s2: you leave presenting
  s7 --> s2: you close the dialog
  s7 --> s9: you invite people
  s7 --> s10: you open more actions
  s8 --> s0: you go back home
  s9 --> s7: you press done
  s6 --> s5: you leave presenting
  s10 --> s2: you close the dialog
  s7 --> s5: you close the dialog
  s10 --> s5: you close the dialog
```
