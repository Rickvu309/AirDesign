# Design backlog

States the strategy promises that have no screen yet, found by the strategy and logic reviews on 2026-11-04 ([reviews](reviews/)). Build the designed screens first; design these before their flows ship. New screens take the next number in their flow.

| Area | Missing states |
|---|---|
| S20 Access | Wrong or expired code state on S22.01, with the 30 second resend wait. |
| S30 Decks | Deck menu (rename, duplicate, move to Trash), rename in place, search results and no results. A deck deleted in another tab turns the editor read-only with a way back to Home. |
| S40 Editor | First request in a new empty deck (F02). Changes by slide when the activity line opens, with checks and anything outside the selection. Paste that fails or is partly refused (S41.04). |
| S43 Tools | Template picker in two modes: insert a slide or apply to the deck. Save a template and set a default (F11, F08). Image library, crop, focal point, alt text, upload refused, storage full, no stock results (F12). Actions turn off when nothing suitable is selected (S43.07). |
| S49 Editor errors | Run failed thumbnails show only the slides that were built. AirDesign down and Retrying states (F15). Offline edits that hit a deleted slide offer to restore it. |
| S60 Export | Flagged items review with Fix and Export anyway. Export during a run: export now or when the run ends. Export ready again after the tab was closed (F04). |
| S70 Agents | Connected page fallback when the agent does not open. Approval that expired after sign-in restarts the connection. Connection ended during a run, with reconnect. |
| S80 Settings | Manage connection: each connection with its device, approved and last used, and End connection. Turning Aira off during a run stops the run. Edit profile and change email (confirm at both addresses, address already used). Delete account confirm (credits lost, connections end, data removed within 30 days). |
| S90 Credits | Waiting and result over the editor when a payment started from the limit card. Auto reset off and weekly cap reached. A payment still being checked after its link expired. |
| S10 Discover | Real product screenshot, real PowerPoint before and after, customer proof. Agent guides (S13) with a plain text version for agents. |
