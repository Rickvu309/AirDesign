# An agent learns what a slide paints wrong without an open tab: every edit and read answer measures the slides it touched with the deck's own fonts on the server, lists each overflow, overlap, off-slide and small-text finding, says when the layout is clear or went unchecked, and never refuses the edit

`packages/mcp/src/layout-answers.test.ts` lands an edit that covers a title's words and fails unless the answer names the overlap, reads a deck and fails unless it lists the findings and the painted sizes, and fails unless a clear layout and an unread font each say so in the note
