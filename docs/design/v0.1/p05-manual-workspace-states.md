# Manual workspace states

These states extend the S31, S33, S41, S49 and S61 handoff for P05. C10 governs the empty Home and pending first request. The desktop uses the handoff's quiet light canvas, white cards, blue primary action and floating editor controls. Phones retain the deck canvas and reflow surrounding controls into one column.

| State | Content and action | Focus and recovery |
| --- | --- | --- |
| Empty Home | No seeded decks. New deck opens an empty editor. Import accepts a local PowerPoint. | Search and New deck stay keyboard reachable. |
| First request | A field above the empty canvas says Describe your deck. Save request stores it with Pending — Aira is not available yet. Add slide starts manual editing. | Saving announces in a status region and leaves focus in the field. The request survives sign-in and deck creation. |
| Changes by slide | A disclosure lists committed contributions, affected slide or element ids, actor and active state. Undo change targets that contribution through P04 history. | Opening the disclosure leaves focus on its summary. Undo announces without moving focus. |
| Deleted elsewhere | A persistent notice says This deck is in Trash. It is read-only. Home and Restore are available. Local unsaved work remains recoverable. | Disable editing and Export; keep focus on an available control. |
| Paste refused or partial | Before insertion, show accepted slide count, every refused slide and reason, and the original paste. Insert accepted slides is explicit; Cancel leaves the deck unchanged. | The review receives focus. Closing returns to the paste trigger. Never clear the source on refusal. |
| Export flags | List each flagged item and its slide. Fix selects that slide and closes the dialog. Export anyway records acknowledgement in the report. | Return to Export retains the choice. Status and errors do not move focus. |
| Export during a run | Choose Export saved version now or After run. Both choices identify the resulting saved revision. | Never export an optimistic local projection. |
| Reopened result | Show the same operation id and retained artifact. A failure keeps its diagnostic and offers Retry for the same revision. | The result is attached to the deck and owner, independently of the tab. |

PowerPoint proof and assistive-technology announcement transcripts remain the P09 external gates. Local accessibility-tree checks are required here.
