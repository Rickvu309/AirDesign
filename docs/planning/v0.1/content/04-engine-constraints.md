_AirDesign / v0.1 / Engine_

# Enabling constraints

The fixed points for the four other hard parts. Numbers are starting values from the research, tuned on real data. Reports in airdesign-research/.

## PowerPoint import and export

1. An unchanged export returns every original part byte for byte, except listed security removals and AirDesign data.
2. Unknown stays, even inside native shapes. One text edit changes only that text.
3. No broken files. Every change carries the parts and links it depends on. PowerPoint never asks to repair.
4. Real PowerPoint is the judge, same build, fonts and OS. Start at 0.1 percent of pixels per slide, 1 percent per item, no changed line counts. LibreOffice only for fast checks.
5. Fonts are pinned: files, fallbacks and autofit recorded. Missing fonts always reported.
6. Every file is hostile: 100 MB, 500 MB unpacked, 10,000 parts, 30 s, in a worker that can be killed.

## Live sync and undo

1. One order per deck. Each commit is one database transaction.
2. Versions per property. Structure is checked too: parent, order, existence. Ids are never reused.
3. Agents are version-checked strictly. The person's edits always land, in the order they arrive.
4. A property the person edits is protected from agent runs that started before the edit. Their next request may change it.
5. A change id never applies twice. An old id with a new payload is an error.
6. Undo of a run is rebuilt from history, never a blind inverse, and keeps later person edits.
7. Commit to paint within 100 ms for a connected editor, traced end to end.

## Agent tools

1. At most 20 tools, described in at most 8,000 tokens. Checked in CI.
2. Results under 20 KB. Pages of 20, at most 50, never cut mid-element.
3. Every write carries a request id. Edits name a base version. All or nothing.
4. One error shape: code, message, retryable, what to do next.
5. One access wrapper for both agents: ownership and rate limits. No delete, billing or account tools.
6. Warm p95: reads 500 ms, edits 1 s, captures 2 s. Slow work returns an operation id within 1 s.
7. Before any tool change: at least 90 percent on 40 or more tasks, 3 trials, on two models, no task worse.

## Stunning, measured

1. Hard checks pass: no clipped text, no unintended overlap, contrast passes, images sharp at their size.
2. Layout is visible to checks: anchors, margins, groups and roles.
3. A vision judge compares against a blind baseline, in both orders.
4. Release bar: 44 of 48 tasks, 7 of 8 in every family, no task worse.
5. People recalibrate the judge every month.
6. It stays editable: text and charts are real, checked on the exported file.

